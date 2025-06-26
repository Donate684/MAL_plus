chrome.storage.sync.get({ peoplePlusEnabled: true }, (data) => {
    if (data.peoplePlusEnabled) {

        /**
         * Main function to initialize all relevant filters on the page.
         * It now checks for each section independently.
         */
        function initializeFilters() {
            // Check for Voice Acting Roles
            const voiceActingTable = document.querySelector('.js-table-people-character');
            if (voiceActingTable && !document.querySelector('.role-filter-container')) {
                initializeRoleFilter(voiceActingTable);
            }

            // Check for Anime Staff Positions
            const staffTable = document.querySelector('.js-table-people-staff');
            if (staffTable && !document.querySelector('.staff-filter-container')) {
                initializeStaffFilter(staffTable);
            }

            // Check for Published Manga
            const mangaTable = document.querySelector('.js-table-people-manga');
            if (mangaTable && !document.querySelector('.manga-filter-container')) {
                initializeMangaFilter(mangaTable);
            }
        }

        // --- PARSING HELPERS ---

        function robustlySplitPositions(text) {
            if (!text) return [];
            const positions = [];
            let currentPosition = '';
            let parenDepth = 0;
            for (const char of text) {
                if (char === '(') parenDepth++;
                if (char === ')') parenDepth--;
                if (char === ',' && parenDepth === 0) {
                    positions.push(currentPosition);
                    currentPosition = '';
                } else {
                    currentPosition += char;
                }
            }
            if (currentPosition) {
                positions.push(currentPosition);
            }
            return positions.map(p => p.trim());
        }

        function cleanPositionTitle(positionString) {
            const parenIndex = positionString.indexOf('(');
            return (parenIndex !== -1 ? positionString.substring(0, parenIndex) : positionString).trim();
        }

        // --- INITIALIZER FUNCTIONS ---

        function initializeRoleFilter(table) {
            const parentContainer = document.querySelector('.people-character.navi-people-character');
            if (!parentContainer) return;

            const allRoleRows = table.querySelectorAll('tr.js-people-character');
            if (allRoleRows.length === 0) return;

            let mainCount = 0,
                supportingCount = 0;
            allRoleRows.forEach(row => {
                const roleText = row.querySelector('td:nth-of-type(3) > div:nth-of-type(2)')?.textContent.trim();
                if (roleText === 'Main') mainCount++;
                else if (roleText === 'Supporting') supportingCount++;
            });

            const options = [
                { type: 'all', text: `All (${allRoleRows.length})` },
                { type: 'main', text: `Main (${mainCount})` },
                { type: 'supporting', text: `Supporting (${supportingCount})` }
            ];

            const panelClass = 'people-character-sort-order-block';
            const { container, button } = createFilter('Selected Role: All', options, 'role-filter-container', panelClass);
            parentContainer.appendChild(container);

            button.addEventListener('click', () => {
                applyRoleFilter(allRoleRows, container);
                updateRoleButtonText(button, container);
            });
        }

        function initializeStaffFilter(table) {
            const parentContainer = document.querySelector('.people-staff.navi-people-staff');
            if (!parentContainer) return;

            const allStaffRows = table.querySelectorAll('tr.js-people-staff');
            if (allStaffRows.length === 0) return;

            const workCounts = {};
            allStaffRows.forEach(row => {
                const positionsText = row.querySelector('td:nth-of-type(2) > .spaceit_pad > small')?.textContent.trim();
                const rawPositions = robustlySplitPositions(positionsText);
                const cleanedPositions = rawPositions.map(cleanPositionTitle);
                cleanedPositions.forEach(pos => {
                    if (pos) {
                        workCounts[pos] = (workCounts[pos] || 0) + 1;
                    }
                });
            });

            const sortedWorks = Object.keys(workCounts).sort();
            const options = [
                { type: 'all', text: `All (${allStaffRows.length})` },
                ...sortedWorks.map(work => ({ type: work, text: `${work} (${workCounts[work]})` }))
            ];

            const panelClass = 'people-staff-sort-order-block';
            const { container, button } = createFilter('Filter by Work: All', options, 'staff-filter-container', panelClass);
            parentContainer.appendChild(container);

            button.addEventListener('click', () => {
                applyStaffFilter(allStaffRows, container);
                updateStaffButtonText(button, container, sortedWorks.length);
            });
        }

        function initializeMangaFilter(table) {
            const parentContainer = document.querySelector('.people-manga.navi-people-manga');
            if (!parentContainer) return;

            const allMangaRows = table.querySelectorAll('tr.js-people-manga');
            if (allMangaRows.length === 0) return;

            const creditCounts = {};
            allMangaRows.forEach(row => {
                const creditText = row.querySelector('td:nth-of-type(2) > .spaceit_pad > small')?.textContent.trim();
                if (creditText) {
                    creditCounts[creditText] = (creditCounts[creditText] || 0) + 1;
                }
            });

            const sortedCredits = Object.keys(creditCounts).sort();
            const options = [
                { type: 'all', text: `All Credits (${allMangaRows.length})` },
                ...sortedCredits.map(credit => ({ type: credit, text: `${credit} (${creditCounts[credit]})` }))
            ];

            const panelClass = 'people-manga-sort-order-block';
            const { container, button } = createFilter('Filter by Credit: All', options, 'manga-filter-container', panelClass);
            parentContainer.appendChild(container);

            button.addEventListener('click', () => {
                applyMangaFilter(allMangaRows, container);
                updateMangaButtonText(button, container, sortedCredits.length);
            });
        }


        /**
         * Generic function to create the filter button and panel.
         */
        function createFilter(buttonText, options, containerClass, panelClass) {
            const filterContainer = document.createElement('div');
            filterContainer.className = `fl-r custom-filter-container ${containerClass} mr12`;

            const filterButton = document.createElement('span');
            filterButton.className = 'btn-show-sort js-btn-show-sort';
            filterButton.textContent = buttonText;

            const filterPanel = document.createElement('div');
            filterPanel.className = `${panelClass} mylist custom-filter-panel`;
            filterPanel.style.display = 'none';

            const closeButton = document.createElement('span');
            closeButton.className = 'fl-r btn-close js-btn-close';
            closeButton.innerHTML = '<i class="fa-solid fa-times"></i>';

            const optionsList = document.createElement('ul');
            optionsList.className = 'sort-order-list';
            optionsList.innerHTML = options.map(opt =>
                `<li class="js-btn-sort-order btn-sort-order selected ml12" data-filter="${opt.type}">${opt.text}</li>`
            ).join('');

            if (optionsList.querySelector('li')) {
                optionsList.querySelector('li').classList.remove('ml12');
            }

            filterPanel.appendChild(closeButton);
            filterPanel.appendChild(optionsList);
            filterContainer.appendChild(filterButton);
            filterContainer.appendChild(filterPanel);

            filterButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = filterPanel.style.display === 'block';
                document.querySelectorAll('.js-people-character-sort-order-block, .js-people-staff-sort-order-block, .js-people-manga-sort-order-block').forEach(p => p.style.display = 'none');
                filterPanel.style.display = isVisible ? 'none' : 'block';
            });

            closeButton.addEventListener('click', () => filterPanel.style.display = 'none');
            document.addEventListener('click', (e) => {
                if (!filterContainer.contains(e.target)) {
                    filterPanel.style.display = 'none';
                }
            });

            optionsList.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-sort-order')) return;
                const clickedBtn = e.target;
                const allBtn = optionsList.querySelector('[data-filter="all"]');

                clickedBtn.classList.toggle('selected');

                if (clickedBtn === allBtn) {
                    optionsList.querySelectorAll('li').forEach(li => li.classList.toggle('selected', allBtn.classList.contains('selected')));
                } else {
                    const allOptions = Array.from(optionsList.querySelectorAll('li:not([data-filter="all"])'));
                    allBtn.classList.toggle('selected', allOptions.every(li => li.classList.contains('selected')));
                }
                filterButton.click();
            });

            return { container: filterContainer, button: filterButton };
        }

        // --- SPECIFIC FILTER/UPDATE LOGIC FUNCTIONS ---

        function applyRoleFilter(rows, container) {
            const showMain = container.querySelector('[data-filter="main"]').classList.contains('selected');
            const showSupporting = container.querySelector('[data-filter="supporting"]').classList.contains('selected');
            rows.forEach(row => {
                const roleText = row.querySelector('td:nth-of-type(3) > div:nth-of-type(2)')?.textContent.trim();
                const show = (showMain && roleText === 'Main') || (showSupporting && roleText === 'Supporting');
                row.style.display = show ? '' : 'none';
            });
        }

        function updateRoleButtonText(button, container) {
            const isMain = container.querySelector('[data-filter="main"]').classList.contains('selected');
            const isSup = container.querySelector('[data-filter="supporting"]').classList.contains('selected');
            let statusText = 'None';
            if (isMain && isSup) statusText = 'All';
            else if (isMain) statusText = 'Main';
            else if (isSup) statusText = 'Supporting';
            button.textContent = `Selected Role: ${statusText}`;
        }

        function applyStaffFilter(rows, container) {
            const selectedFilters = new Set(
                Array.from(container.querySelectorAll('li.selected:not([data-filter="all"])'))
                .map(li => li.dataset.filter)
            );
            rows.forEach(row => {
                const positionsText = row.querySelector('td:nth-of-type(2) > .spaceit_pad > small')?.textContent.trim();
                let show = false;
                if (positionsText) {
                    const rawPositions = robustlySplitPositions(positionsText);
                    const cleanedPositions = rawPositions.map(cleanPositionTitle);
                    show = cleanedPositions.some(pos => selectedFilters.has(pos));
                }
                row.style.display = show ? '' : 'none';
            });
        }

        function updateStaffButtonText(button, container, totalOptions) {
            const selectedCount = container.querySelectorAll('li.selected:not([data-filter="all"])').length;
            let statusText;
            if (selectedCount === totalOptions) statusText = 'All';
            else if (selectedCount === 0) statusText = 'None';
            else statusText = `${selectedCount} Selected`;
            button.textContent = `Filter by Work: ${statusText}`;
        }

        function applyMangaFilter(rows, container) {
            const selectedFilters = new Set(
                Array.from(container.querySelectorAll('li.selected:not([data-filter="all"])'))
                .map(li => li.dataset.filter)
            );
            rows.forEach(row => {
                const creditText = row.querySelector('td:nth-of-type(2) > .spaceit_pad > small')?.textContent.trim();
                const show = selectedFilters.has(creditText);
                row.style.display = show ? '' : 'none';
            });
        }

        function updateMangaButtonText(button, container, totalOptions) {
            const selectedCount = container.querySelectorAll('li.selected:not([data-filter="all"])').length;
            let statusText;
            if (selectedCount === totalOptions) statusText = 'All';
            else if (selectedCount === 0) statusText = 'None';
            else statusText = `${selectedCount} Selected`;
            button.textContent = `Filter by Credit: ${statusText}`;
        }


        /**
         * Observer to run the script as soon as the page content is available.
         */
        const observer = new MutationObserver((mutations, obs) => {
            // The target element is one of the headers for the sections
            const targetHeader = document.querySelector('h2.h2_overwrite');
            if (targetHeader) {
                initializeFilters();
                // We don't disconnect, as some pages might load sections dynamically.
                // A check at the start of each initializer prevents duplication.
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

    }
});