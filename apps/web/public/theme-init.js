// Тема до первой отрисовки: сохранённый выбор или системная — без вспышки светлой темы.
// Отдельным файлом, а не встроенным скриптом: CSP запрещает встроенные скрипты.
(function () {
  var theme = null;
  try {
    theme = localStorage.getItem('webmotiv.theme');
  } catch {
    // Хранилище недоступно — тема как в системе.
  }
  var dark =
    theme === 'dark' ||
    (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
})();
