import { contextBridge } from 'electron';

// Minimal, safe bridge. Expand later if you need native menus, file dialogs, etc.
// Kept intentionally small: the map app runs as a normal web page inside the window.
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  isElectron: true
});
