# Auton MCP Server

Model Context Protocol (MCP) server for interacting with the Auton API. This server provides tools for uploading content and generating iframe embed codes for content viewers.

## Features

- **Upload Content**: Upload files to the Auton platform via the `/api/upload` endpoint
- **Generate Iframe Code**: Generate HTML iframe embed code for embedding Auton content viewers on external websites

## Requirements

- Node.js 18.0.0 or higher (for built-in FormData and fetch support)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

## Configuration

The server uses the following default URLs (can be overridden per request):
- API Base URL: `http://localhost:3000/api`
- Frontend Base URL: `http://localhost:3000`

You can override these by passing `apiBaseUrl` or `baseUrl` parameters in tool calls.

## Usage

### Starting the Server

```bash
npm start
```

The server runs on stdio and communicates via the MCP protocol.

### Tool: `upload_content`

Uploads a file to the Auton platform and returns an encrypted CID.

**Parameters:**
- `file` (required): Base64-encoded file data
- `fileName` (required): Name of the file (e.g., "document.pdf")
- `title` (required): Title of the content
- `description` (optional): Description of the content
- `price` (required): Price in SOL
- `creatorId` (required): Creator wallet address
- `apiBaseUrl` (optional): API base URL (default: "http://localhost:3000/api")

**Example:**
```json
{
  "file": "base64EncodedFileData...",
  "fileName": "my-document.pdf",
  "title": "My Premium Content",
  "description": "This is a premium document",
  "price": 0.1,
  "creatorId": "YourWalletAddressHere",
  "apiBaseUrl": "http://localhost:3000/api"
}
```

**Response:**
```json
{
  "success": true,
  "encryptedCid": "encryptedCidString...",
  "message": "Content uploaded successfully"
}
```

### Tool: `get_content_iframe`

Generates HTML iframe code for embedding an Auton content viewer.

**Parameters:**
- `creatorId` (required): Creator wallet address or username
- `contentId` (optional): Specific content ID to display
- `baseUrl` (optional): Frontend base URL (default: "http://localhost:3000")
- `width` (optional): Iframe width (default: "100%")
- `height` (optional): Iframe height (default: "600px")

**Example:**
```json
{
  "creatorId": "CreatorWalletAddress",
  "contentId": "123",
  "baseUrl": "https://your-domain.com",
  "width": "100%",
  "height": "800px"
}
```

**Response:**
```json
{
  "success": true,
  "iframeCode": "<iframe src=\"...\" width=\"100%\" height=\"600px\" ...></iframe>",
  "url": "https://your-domain.com/creators/CreatorWalletAddress?contentId=123",
  "message": "Iframe code generated successfully"
}
```

## Integration with Cursor/IDE

To use this MCP server with Cursor or other MCP-compatible IDEs:

1. Add the server configuration to your MCP settings:

```json
{
  "mcpServers": {
    "auton": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

2. Restart your IDE to load the MCP server.

3. The tools will be available in your IDE's MCP tool list.

## Development

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

This will watch for changes and rebuild automatically.

## Project Structure

```
mcp-server/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── types.ts              # TypeScript type definitions
│   └── tools/
│       ├── upload-content.ts # Upload content tool
│       └── get-iframe.ts     # Get iframe code tool
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Error Handling

The server handles errors gracefully and returns structured error responses:

- **Invalid Parameters**: Returns `InvalidParams` error with details
- **Upload Failures**: Returns error details from the API response
- **Internal Errors**: Returns generic error messages

## Notes

- The upload tool handles the file upload step. Additional on-chain operations (Solana transactions) may be required for full content creation.
- The iframe code is ready to use and can be embedded directly in HTML pages.
- All file uploads are encrypted before being stored on IPFS.

## License

MIT

