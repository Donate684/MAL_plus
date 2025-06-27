chrome.storage.sync.get({ staffPlusEnabled: true }, (data) => {
    if (data.staffPlusEnabled) {
        /**
         * This script injects a custom analytics block on MyAnimeList anime pages.
         * ... (v7.9) Fixes cache status display logic.
         */

        const pathSegments = window.location.pathname.split('/').filter(Boolean);

        // Listener for messages from the popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "clearCacheAndReload") {
                const db = new Dexie('malPlusCache');
                console.log("MAL+ Enhancer: Received request to clear cache.");
                db.delete().then(() => {
                    console.log("MAL+ Enhancer: Cache cleared. Reloading page.");
                    window.location.reload();
                    sendResponse({success: true});
                }).catch(error => {
                    console.error("MAL+ Enhancer: Failed to clear cache.", error);
                    sendResponse({success: false, error: error.message});
                });
                return true; // Indicates that the response is sent asynchronously
            }
        });

        if (pathSegments.length < 4 && pathSegments[0] === 'anime') {

            console.log('MAL+ Enhancer: Main anime page detected, running script.');

            const db = new Dexie('malPlusCache');
            db.version(7).stores({
                animeData: '++id, animeId, staffList, timestamp',
                personCache: '++id, personId, filmography, timestamp'
            });

            const ROLES_TO_FETCH = ['Original Creator', 'Director', 'Series Composition', 'Script', 'Music', 'Character Design'];
            const CACHE_EXPIRATION_24H = 24 * 60 * 60 * 1000;
            const LANGUAGE_BLACKLIST = ['French', 'Spanish', 'German', 'English', 'Italian', 'Korean', 'Chinese', 'Russian'];


            async function fetchViaBackground(url) {
                return new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ action: 'fetchUrl', url }, response => {
                        if (chrome.runtime.lastError) {
                            return reject(new Error(`Background script error: ${chrome.runtime.lastError.message}`));
                        }
                        if (response && response.success) {
                            resolve(response.data);
                        } else {
                            reject(new Error(response ? response.error : "Unknown error fetching via background script."));
                        }
                    });
                });
            }

            function parseBestWorks(filmography, primaryRole, currentAnimeUrl) {
                if (!filmography || filmography.length === 0) return [];
                const currentAnimeId = currentAnimeUrl.split('/')[4];
                const relevantWorks = filmography.filter(work => {
                    const workAnimeId = work.url.split('/')[4];
                    if (workAnimeId === currentAnimeId) return false;
                    return work.roles.some(role => role.startsWith(primaryRole));
                });
                relevantWorks.sort((a, b) => b.score - a.score);
                return relevantWorks;
            }
            
            function formatTimeAgo(timestamp) {
                const diff = Date.now() - timestamp;
                const seconds = Math.floor(diff / 1000);
                const minutes = Math.floor(seconds / 60);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);

                if (days > 0) return `(cached ${days} day${days > 1 ? 's' : ''} ago)`;
                if (hours > 0) return `(cached ${hours} hour${hours > 1 ? 's' : ''} ago)`;
                if (minutes > 0) return `(cached ${minutes} min${minutes > 1 ? 's' : ''} ago)`;
                return `(cached ${seconds} sec${seconds > 1 ? 's' : ''} ago)`;
            }

            async function getOrFetchPersonFilmography(personUrl) {
                const personIdMatch = personUrl.match(/\/people\/(\d+)\//);
                if (!personIdMatch) return null;
                const personId = personIdMatch[1];
                const cachedPerson = await db.personCache.where('personId').equals(personId).first();
                if (cachedPerson && (Date.now() - cachedPerson.timestamp < CACHE_EXPIRATION_24H)) {
                    return cachedPerson.filmography;
                }
                const htmlText = await fetchViaBackground(personUrl);
                const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                const filmography = [];
                const staffTable = doc.querySelector('table.js-table-people-staff');
                if (staffTable) {
                    staffTable.querySelectorAll('tr.js-people-staff').forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length < 3) return;
                        const animeLink = cells[1].querySelector('a');
                        if (!animeLink) return;
                        const rolesText = cells[1].querySelector('small')?.textContent.trim() || '';
                        const roles = rolesText ? rolesText.split(/,\s*(?![^()]*\))/g).map(r => r.trim()) : [];
                        filmography.push({
                            title: animeLink.textContent.trim(),
                            url: animeLink.href,
                            roles: roles,
                            score: parseFloat(cells[2].querySelector('span.score-val')?.textContent.trim()) || 0,
                            type: (cells[1].querySelector('div.anime-info-text')?.textContent.trim() || '').split(',')[0].trim(),
                            air_date_str: cells[1].querySelector('div.anime-info-text')?.textContent.trim() || '',
                            members: parseInt((cells[2].querySelector('.series-total-members')?.textContent.trim() || '0').replace(/[^0-9]/g, ''), 10) || 0
                        });
                    });
                }
                if (cachedPerson) {
                    await db.personCache.where('personId').equals(personId).modify({ filmography, timestamp: Date.now() });
                } else {
                    await db.personCache.put({ personId, filmography, timestamp: Date.now() });
                }
                return filmography;
            }

            async function createCustomBlock() {
                const staffHeadings = Array.from(document.querySelectorAll('h2'));
                const originalStaffHeading = staffHeadings.find(h2 => h2.textContent.trim() === 'Staff');
                if (!originalStaffHeading || !originalStaffHeading.parentElement) {
                    console.error("MAL+ Enhancer: Could not find the original 'Staff' heading.");
                    return;
                }
                const originalStaffHeadingContainer = originalStaffHeading.parentElement;

                const charactersListDiv = document.querySelector('.detail-characters-list.clearfix');
                if (!charactersListDiv) {
                    console.error("MAL+ Enhancer: Could not find the 'Characters & Voice Actors' list.");
                    return;
                }

                const customBlockWrapper = document.createElement('div');
                customBlockWrapper.style.marginBottom = '20px';
                customBlockWrapper.style.marginTop = '20px';

                const clonedHeadingContainer = originalStaffHeadingContainer.cloneNode(true);
                const clonedHeading = clonedHeadingContainer.querySelector('h2');
                
                clonedHeading.innerHTML = 'Staff+ <span class="staff-plus-cache-status" style="font-size: 11px; color: #a5a5a5; font-weight: normal; margin-left: 5px;"></span>';
                const cacheStatusElement = clonedHeading.querySelector('.staff-plus-cache-status');
                
                clonedHeadingContainer.style.display = '';

                const staffInfoContainer = document.createElement('div');
                staffInfoContainer.innerHTML = '<p style="margin-top: 10px;">Loading creator data...</p>';
                customBlockWrapper.appendChild(clonedHeadingContainer);
                customBlockWrapper.appendChild(staffInfoContainer);

                loadAndDisplayStaff(staffInfoContainer, cacheStatusElement);

                charactersListDiv.insertAdjacentElement('afterend', customBlockWrapper);

                // --- HIDING ORIGINAL ELEMENTS ---

                const staffAnchor = document.querySelector('a[name="staff"]');
                if (staffAnchor) {
                    staffAnchor.style.display = 'none';
                    if (staffAnchor.previousElementSibling && staffAnchor.previousElementSibling.tagName === 'BR') {
                        staffAnchor.previousElementSibling.style.display = 'none';
                    }
                }
                
                originalStaffHeadingContainer.style.display = 'none';

                let staffContent = originalStaffHeadingContainer.nextElementSibling;
                if (staffContent && staffContent.classList.contains('detail-characters-list')) {
                    staffContent.style.display = 'none';

                    let br1 = staffContent.nextElementSibling;
                    if (br1 && br1.tagName === 'BR') {
                        br1.style.display = 'none';
                        let br2 = br1.nextElementSibling;
                         if (br2 && br2.tagName === 'BR') {
                            br2.style.display = 'none';
                        }
                    }
                }
            }


            function findStaffTables(doc) {
                const staffHeading = Array.from(doc.querySelectorAll('h2')).find(h2 => h2.textContent.trim() === 'Staff');
                const staffTables = [];
                if (staffHeading) {
                    let currentNode = staffHeading.parentElement.nextElementSibling;
                    while (currentNode && currentNode.tagName !== 'H2') {
                        if (currentNode.tagName === 'TABLE' && currentNode.querySelector('a[href*="/people/"]')) {
                            staffTables.push(currentNode);
                        }
                        currentNode = currentNode.nextElementSibling;
                    }
                }
                return staffTables;
            }

            function checkOverflowAndAddArrows(container) {
                const wrappers = container.querySelectorAll('.best-works-wrapper');

                wrappers.forEach(wrapper => {
                    const bestWorksContainer = wrapper.querySelector('.best-works-container');
                    const listElement = bestWorksContainer ? bestWorksContainer.querySelector('ul') : null;

                    if (!bestWorksContainer || !listElement || listElement.children.length === 0) {
                        return;
                    }

                    const PIXEL_TOLERANCE = 2;
                    const isOverflowing = listElement.offsetHeight > bestWorksContainer.clientHeight + PIXEL_TOLERANCE;

                    if (isOverflowing) {
                        if (wrapper.querySelector('.expand-arrow')) return;

                        const arrow = document.createElement('div');
                        arrow.className = 'expand-arrow';
                        arrow.setAttribute('role', 'button');
                        arrow.setAttribute('title', 'Show more/less');
                        arrow.innerHTML = '▼';
                        wrapper.appendChild(arrow);
                    }
                });
            }

            async function loadAndDisplayStaff(targetContainer, cacheStatusElement) {
                try {
                    const animeId = window.location.pathname.split('/')[2];
                    const currentAnimeUrl = window.location.href;
                    let preliminaryStaffList;

                    const cachedData = await db.animeData.where('animeId').equals(animeId).first();
                    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRATION_24H)) {
                        preliminaryStaffList = cachedData.staffList;
                        if (cacheStatusElement) {
                            cacheStatusElement.textContent = formatTimeAgo(cachedData.timestamp);
                        }
                    } else {
                        if (cacheStatusElement) {
                            cacheStatusElement.textContent = '';
                        }
                        const staffUrl = window.location.origin + `/anime/${animeId}/_/characters`;
                        const htmlText = await fetchViaBackground(staffUrl);
                        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                        const staffTables = findStaffTables(doc);
                        const staffMap = new Map();
                        staffTables.forEach(table => {
                            table.querySelectorAll('tr').forEach(row => {
                                const cells = row.querySelectorAll('td');
                                if (cells.length < 2) return;
                                const nameLink = cells[1].querySelector('a');
                                if (!nameLink) return;
                                const url = nameLink.href;
                                const cleanRoles = (cells[1].querySelector('small')?.textContent.trim() || '').split(',').map(r => r.trim()).filter(role => ROLES_TO_FETCH.includes(role));
                                if (url && cleanRoles.length > 0) {
                                    if (staffMap.has(url)) {
                                        staffMap.get(url).roles.push(...cleanRoles.filter(r => !staffMap.get(url).roles.includes(r)));
                                    } else {
                                        const imgElement = cells[0].querySelector('img');
                                        let thumbnailUrl = imgElement?.dataset.src || imgElement?.src || null;
                                        if (thumbnailUrl) thumbnailUrl = thumbnailUrl.replace(/\/r\/\d+x\d+\//, '/');
                                        staffMap.set(url, { name: nameLink.textContent.trim(), url, thumbnailUrl, roles: cleanRoles });
                                    }
                                }
                            });
                        });
                        preliminaryStaffList = Array.from(staffMap.values());
                        if (preliminaryStaffList.length > 0) {
                             await db.animeData.put({ animeId, staffList: preliminaryStaffList, timestamp: Date.now() });
                        }
                    }
                    if (!preliminaryStaffList || preliminaryStaffList.length === 0) {
                        targetContainer.innerHTML = '<p>No key creators found for the specified roles.</p>';
                        return;
                    }

                    const staffWithDataPromises = preliminaryStaffList.map(async (person) => {
                        const filmography = await getOrFetchPersonFilmography(person.url);
                        if (!filmography) return null;
                        const workOnPage = filmography.find(work => work.url.includes(`/anime/${animeId}/`));
                        if (!workOnPage || !workOnPage.roles) return null;
                        const finalRoles = [];
                        person.roles.forEach(simpleRole => {
                            const matchedDetailedRole = workOnPage.roles.find(detailedRole => {
                                const trimmedDetailedRole = detailedRole.trim();
                                if (simpleRole === 'Character Design') {
                                    return trimmedDetailedRole === simpleRole;
                                }
                                if (trimmedDetailedRole.startsWith(simpleRole)) {
                                    const parenthesisMatch = trimmedDetailedRole.match(/\((.*?)\)/);
                                    if (parenthesisMatch) {
                                        const contentInParentheses = parenthesisMatch[1].trim();
                                        if (LANGUAGE_BLACKLIST.includes(contentInParentheses)) {
                                            return false;
                                        }
                                    }
                                    return true;
                                }
                                return false;
                            });
                            if (matchedDetailedRole) {
                                finalRoles.push({
                                    baseRole: simpleRole,
                                    displayRole: matchedDetailedRole
                                });
                            }
                        });
                        if (finalRoles.length === 0) return null;
                        const bestWorksByRole = {};
                        finalRoles.forEach(roleInfo => {
                            const bestWorks = parseBestWorks(filmography, roleInfo.baseRole, currentAnimeUrl);
                            bestWorksByRole[roleInfo.displayRole] = bestWorks;
                        });
                        return { ...person, finalRoles, bestWorksByRole };
                    });

                    const processedStaff = (await Promise.all(staffWithDataPromises)).filter(Boolean);
                    if (processedStaff.length === 0) {
                        targetContainer.innerHTML = '<p>No key creators found after verification.</p>';
                        return;
                    }

                    const staffForRendering = processedStaff.flatMap(person =>
                        person.finalRoles.map(roleInfo => ({
                            ...person,
                            role: roleInfo.displayRole,
                            bestWorks: person.bestWorksByRole[roleInfo.displayRole] || []
                        }))
                    );

                    staffForRendering.sort((a, b) => {
                        const aIsCreator = a.role === 'Original Creator';
                        const bIsCreator = b.role === 'Original Creator';
                        if (aIsCreator && !bIsCreator) return -1;
                        if (!aIsCreator && bIsCreator) return 1;
                        return 0;
                    });

                    renderStaff(staffForRendering, targetContainer);

                    await document.fonts.ready;
                    requestAnimationFrame(() => {
                        checkOverflowAndAddArrows(targetContainer);
                    });

                    if (!targetContainer.dataset.listenerAttached) {
                        targetContainer.addEventListener('click', (event) => {
                            const arrow = event.target.closest('.expand-arrow');
                            if (arrow) {
                                const container = arrow.previousElementSibling;

                                if (container && container.classList.contains('best-works-container')) {
                                    const isExpanded = container.classList.contains('expanded');

                                    if (isExpanded) {
                                        container.style.maxHeight = null;
                                        container.classList.remove('expanded');
                                        arrow.classList.remove('expanded');
                                    } else {
                                        const listElement = container.querySelector('ul');
                                        if (listElement) {
                                            container.style.maxHeight = listElement.scrollHeight + 'px';
                                            container.classList.add('expanded');
                                            arrow.classList.add('expanded');
                                        }
                                    }
                                }
                            }
                        });
                        targetContainer.dataset.listenerAttached = 'true';
                    }

                } catch (error) {
                    console.error('Error in loadAndDisplayStaff:', error);
                    targetContainer.innerHTML = `<p style="color: red;">Failed to load creator data: ${error.message}</p>`;
                }
            }

            function renderStaff(staffData, targetContainer) {
                targetContainer.className = 'mal-plus-staff-grid';
                const placeholderImage = 'https://cdn.myanimelist.net/images/questionmark_23.gif?s=f7dcbc4a4603d18356d3dfef8abd655c';

                const gridHtml = staffData.map(person => {
                    let bestWorksHtml = '';
                    if (person.bestWorks.length > 0) {
                         bestWorksHtml = '<ul>' + person.bestWorks.map(work => {
                            const MAX_TITLE_LENGTH = 50;
                            let displayTitle = work.title;
                            if (displayTitle.length > MAX_TITLE_LENGTH) {
                                const truncated = displayTitle.substring(0, MAX_TITLE_LENGTH);
                                const lastSpace = truncated.lastIndexOf(' ');
                                displayTitle = (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
                            }
                            return `<li><a href="${work.url}" target="_blank" title="${work.title} (Score: ${work.score})">${displayTitle}</a> (<span>${work.score}</span>)</li>`;
                        }).join('') + '</ul>';
                    }

                    return `
                        <div class="staff-member-card">
                            <div class="staff-image"><a href="${person.url}" target="_blank"><img src="${person.thumbnailUrl || placeholderImage}" alt="${person.name}" width="42" height="62" loading="lazy"></a></div>
                            <div class="staff-info">
                                <div class="staff-name"><a href="${person.url}" target="_blank">${person.name}</a></div>
                                <div class="staff-role">${person.role}</div>
                                <div class="best-works-wrapper">
                                    <div class="best-works-container">${bestWorksHtml}</div>
                                </div>
                            </div>
                        </div>`;
                }).join('');

                targetContainer.innerHTML = gridHtml || '<p>No key creators found for the specified roles.</p>';
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', createCustomBlock);
            } else {
                createCustomBlock();
            }
        }
    }
});