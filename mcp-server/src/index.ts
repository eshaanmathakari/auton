#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { uploadContentTool, executeUploadContent } from './tools/upload-content.js';
import { getIframeTool, executeGetIframe } from './tools/get-iframe.js';
import { UploadContentParams, GetIframeParams } from './types.js';

/**
 * Auton MCP Server
 * 
 * Provides tools for:
 * - Uploading content to the Auton platform
 * - Generating iframe embed codes for content viewers
 */
class AutonMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'auton-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [uploadContentTool, getIframeTool],
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'upload_content': {
            const uploadParams = args as UploadContentParams & { fileName: string };
            
            // Validate required parameters
            if (!uploadParams.file || !uploadParams.fileName || !uploadParams.title || 
                !uploadParams.price || !uploadParams.creatorId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Missing required parameters: file, fileName, title, price, and creatorId are required'
              );
            }

            const result = await executeUploadContent(uploadParams);
            
            if (!result.success) {
              throw new McpError(
                ErrorCode.InternalError,
                result.message || result.error || 'Upload failed'
              );
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_content_iframe': {
            const iframeParams = args as GetIframeParams;
            
            // Validate required parameters
            if (!iframeParams.creatorId) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Missing required parameter: creatorId is required'
              );
            }

            const result = await executeGetIframe(iframeParams);
            
            if (!result.success) {
              throw new McpError(
                ErrorCode.InternalError,
                result.message || result.error || 'Failed to generate iframe'
              );
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Auton MCP Server running on stdio');
  }
}

// Start the server
const server = new AutonMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

