/* global document */
/* Qualification and role filters for sector guides. The full role list remains
   in the HTML; this script only narrows it when a visitor chooses a level or
   types a search. Without JavaScript every role stays visible. */
(() => {
  'use strict';

  const search = document.querySelector('[data-role-search]');
  const levelFilter = document.querySelector('[data-role-level-filter]');
  const reset = document.querySelector('[data-role-reset]');
  const status = document.querySelector('[data-role-count]');
  const empty = document.querySelector('[data-role-empty]');
  const columns = [...document.querySelectorAll('[data-role-level]')];

  if (!search || !levelFilter || !reset || !status || !empty || !columns.length) return;

  function updateRoles() {
    const query = search.value.trim().toLocaleLowerCase();
    const selectedLevel = levelFilter.value;
    let visibleRoles = 0;
    let visibleLevels = 0;

    for (const column of columns) {
      const levelMatches = selectedLevel === 'all' || column.dataset.roleLevel === selectedLevel;
      const levelName = column.querySelector('.g-col-head')?.textContent.toLocaleLowerCase() || '';
      let columnMatches = 0;

      for (const role of column.querySelectorAll('.g-post')) {
        const textMatches = !query || levelName.includes(query) || role.textContent.toLocaleLowerCase().includes(query);
        const show = levelMatches && textMatches;
        role.toggleAttribute('hidden', !show);
        if (show) columnMatches += 1;
      }

      const showColumn = levelMatches && columnMatches > 0;
      column.toggleAttribute('hidden', !showColumn);
      if (showColumn) {
        visibleRoles += columnMatches;
        visibleLevels += 1;
      }
    }

    empty.toggleAttribute('hidden', visibleRoles > 0);
    status.textContent = visibleRoles
      ? `Showing ${visibleRoles} role option${visibleRoles === 1 ? '' : 's'} across ${visibleLevels} qualification level${visibleLevels === 1 ? '' : 's'}.`
      : 'No matching role options.';
  }

  search.addEventListener('input', updateRoles);
  levelFilter.addEventListener('change', updateRoles);
  reset.addEventListener('click', () => {
    search.value = '';
    levelFilter.value = 'all';
    updateRoles();
    search.focus();
  });
  updateRoles();
})();
