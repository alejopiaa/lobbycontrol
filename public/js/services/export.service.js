/**
 * ExportService - Capa de servicios para exportación de archivos (PDF, Excel, EML)
 */
import { ApiClient } from './api-client.js';

export const ExportService = {
  async selectSavePath(defaultName, filters = []) {
    if (window.api && typeof window.api.selectSavePath === 'function') {
      return await window.api.selectSavePath({ defaultName, filters });
    }
    return { cancelled: true };
  },

  async selectDirectory() {
    if (window.api && typeof window.api.selectDirectory === 'function') {
      return await window.api.selectDirectory();
    }
    return { cancelled: true };
  },

  async generateSilentPdf(htmlContent, filePath, title = 'Documento PDF') {
    if (window.api && typeof window.api.generateSilentPdf === 'function') {
      return await window.api.generateSilentPdf({ html: htmlContent, filePath, title });
    }
    throw new Error('IPC generateSilentPdf no está disponible.');
  },

  async generateExcelFile(filePath, sheetsData) {
    if (window.api && typeof window.api.generateExcelFile === 'function') {
      return await window.api.generateExcelFile({ filePath, sheetsData });
    }
    throw new Error('IPC generateExcelFile no está disponible.');
  },

  async generateEmlAndOpen(emailData) {
    if (window.api && typeof window.api.generateEmlAndOpen === 'function') {
      return await window.api.generateEmlAndOpen(emailData);
    }
    throw new Error('IPC generateEmlAndOpen no está disponible.');
  }
};
