(function () {
  'use strict';

  const COPY_RESET_DELAY = 1500;
  const LIVE_PROCESS_DELAY = 180;

  const inputText = document.getElementById('inputText');
  const resultText = document.getElementById('resultText');
  const caseSensitive = document.getElementById('caseSensitive');
  const trimLines = document.getElementById('trimLines');
  const removeEmptyLines = document.getElementById('removeEmptyLines');
  const sortResult = document.getElementById('sortResult');
  const removeButton = document.getElementById('removeButton');
  const copyButton = document.getElementById('copyButton');
  const clearButton = document.getElementById('clearButton');
  const themeToggle = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');
  const workspace = document.querySelector('.workspace');
  const inputStatus = document.getElementById('inputStatus');
  const resultStatus = document.getElementById('resultStatus');

  const statElements = {
    inputLines: document.getElementById('inputLines'),
    uniqueLines: document.getElementById('uniqueLines'),
    duplicatesRemoved: document.getElementById('duplicatesRemoved'),
    emptyLinesRemoved: document.getElementById('emptyLinesRemoved')
  };

  let copyResetTimer;
  let liveProcessTimer;
  let previousStats = {};

  function getPreferredTheme() {
    const savedTheme = window.localStorage.getItem('duplicateLineRemoverTheme');

    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';

    document.body.classList.toggle('theme-dark', isDark);
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    themeLabel.textContent = isDark ? 'Dark' : 'Light';
    window.localStorage.setItem('duplicateLineRemoverTheme', theme);
  }

  function toggleTheme() {
    const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    applyTheme(nextTheme);
  }

  function getLineCount(text) {
    if (text.length === 0) {
      return 0;
    }

    return text.split(/\r?\n/).length;
  }

  function normalizeLine(line, options) {
    let normalized = options.trimLines ? line.trim() : line;

    if (!options.caseSensitive) {
      normalized = normalized.toLocaleLowerCase();
    }

    return normalized;
  }

  function removeDuplicateLines(text) {
    const options = {
      caseSensitive: caseSensitive.checked,
      trimLines: trimLines.checked,
      removeEmptyLines: removeEmptyLines.checked,
      sortResult: sortResult.checked
    };

    if (text.length === 0) {
      return {
        result: '',
        stats: {
          inputLines: 0,
          uniqueLines: 0,
          duplicatesRemoved: 0,
          emptyLinesRemoved: 0
        }
      };
    }

    const lines = text.split(/\r?\n/);
    const seen = new Set();
    const outputLines = [];
    let duplicatesRemoved = 0;
    let emptyLinesRemoved = 0;

    lines.forEach(function (line) {
      const outputLine = options.trimLines ? line.trim() : line;
      const comparisonValue = normalizeLine(line, options);
      const isEmpty = comparisonValue.trim().length === 0;

      if (options.removeEmptyLines && isEmpty) {
        emptyLinesRemoved += 1;
        return;
      }

      if (seen.has(comparisonValue)) {
        duplicatesRemoved += 1;
        return;
      }

      seen.add(comparisonValue);
      outputLines.push(outputLine);
    });

    if (options.sortResult) {
      outputLines.sort(function (a, b) {
        return a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: options.caseSensitive ? 'variant' : 'base'
        });
      });
    }

    return {
      result: outputLines.join('\n'),
      stats: {
        inputLines: lines.length,
        uniqueLines: outputLines.length,
        duplicatesRemoved: duplicatesRemoved,
        emptyLinesRemoved: emptyLinesRemoved
      }
    };
  }

  function updateStatCards(stats) {
    Object.keys(statElements).forEach(function (key) {
      const element = statElements[key];
      const nextValue = stats[key];
      const card = element.closest('.stat-card');

      if (previousStats[key] !== undefined && previousStats[key] !== nextValue) {
        card.classList.add('is-updated');
        window.setTimeout(function () {
          card.classList.remove('is-updated');
        }, 220);
      }

      element.textContent = nextValue;
    });

    previousStats = stats;
  }

  function updateStatuses(stats) {
    inputStatus.textContent = stats.inputLines === 1 ? '1 original line' : stats.inputLines + ' original lines';
    resultStatus.textContent = stats.uniqueLines === 1 ? '1 cleaned line' : stats.uniqueLines + ' cleaned lines';
    workspace.classList.toggle('has-result', stats.uniqueLines > 0);
  }

  function processText() {
    const processed = removeDuplicateLines(inputText.value);

    resultText.value = processed.result;
    updateStatCards(processed.stats);
    updateStatuses(processed.stats);
  }

  function scheduleProcess() {
    window.clearTimeout(liveProcessTimer);
    liveProcessTimer = window.setTimeout(processText, LIVE_PROCESS_DELAY);
  }

  function fallbackCopy() {
    resultText.focus();
    resultText.select();

    try {
      document.execCommand('copy');
    } catch (error) {
      console.warn('Copy fallback failed.', error);
    }
  }

  function showCopiedState() {
    window.clearTimeout(copyResetTimer);
    copyButton.querySelector('span').textContent = 'Copied!';

    copyResetTimer = window.setTimeout(function () {
      copyButton.querySelector('span').textContent = 'Copy Result';
    }, COPY_RESET_DELAY);
  }

  async function copyResult() {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(resultText.value);
      } catch (error) {
        fallbackCopy();
      }
    } else {
      fallbackCopy();
    }

    showCopiedState();
  }

  function clearAll() {
    window.clearTimeout(liveProcessTimer);
    inputText.value = '';
    resultText.value = '';
    updateStatCards({
      inputLines: 0,
      uniqueLines: 0,
      duplicatesRemoved: 0,
      emptyLinesRemoved: 0
    });
    updateStatuses({
      inputLines: 0,
      uniqueLines: 0,
      duplicatesRemoved: 0,
      emptyLinesRemoved: 0
    });
    inputText.focus();
  }

  function handleKeyboardShortcuts(event) {
    const isClearShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'k';

    if (isClearShortcut) {
      event.preventDefault();
      clearAll();
    }
  }

  inputText.addEventListener('input', scheduleProcess);
  caseSensitive.addEventListener('change', processText);
  trimLines.addEventListener('change', processText);
  removeEmptyLines.addEventListener('change', processText);
  sortResult.addEventListener('change', processText);
  removeButton.addEventListener('click', processText);
  copyButton.addEventListener('click', copyResult);
  clearButton.addEventListener('click', clearAll);
  themeToggle.addEventListener('click', toggleTheme);
  document.addEventListener('keydown', handleKeyboardShortcuts);

  applyTheme(getPreferredTheme());
  clearAll();
})();
