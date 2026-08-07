import type { NextApiResponse, NextApiRequest } from 'next';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const { socket, headers } = req;
    socket.on('error', console.error);

    if (!wss) {
      wss = new WebSocketServer({ noServer: true });
      wss.on('connection', (ws: WebSocket) => {
        console.log('WebSocket client connected');
        ws.on('message', (message: string) => {
          console.log('Received: %s', message);
          ws.send(`Hello! You sent -> ${message}`);
        });
        ws.send('Welcome to the WebSocket server!');
      });
    }

    // Handle the WebSocket upgrade
    wss.handleUpgrade(req, socket, Buffer.alloc(0), (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}