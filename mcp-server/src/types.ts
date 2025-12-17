/**
 * Type definitions for Auton MCP Server
 */

export interface UploadContentParams {
  file: string; // base64 encoded file data or file path
  title: string;
  description?: string;
  price: number; // Price in SOL
  creatorId: string; // Creator wallet address
  apiBaseUrl?: string; // Optional API base URL
}

export interface UploadContentResult {
  success: boolean;
  encryptedCid?: string;
  cid?: string; // If public upload
  error?: string;
  message?: string;
}

export interface GetIframeParams {
  creatorId: string; // Creator wallet address or username
  contentId?: string; // Optional content ID
  baseUrl?: string; // Frontend base URL
  width?: string; // Iframe width (default: "100%")
  height?: string; // Iframe height (default: "600px")
}

export interface GetIframeResult {
  success: boolean;
  iframeCode?: string;
  url?: string;
  error?: string;
  message?: string;
}

