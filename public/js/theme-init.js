(function() {
  try {
    const savedTheme = localStorage.getItem('lobby_theme') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    console.error(e);
  }
})();
