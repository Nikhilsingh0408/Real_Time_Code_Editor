import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();
const codeExecutionQueue = new Map();

// Rate limiting for Piston API (1 request per 200ms)
const executeCode = async (roomId, code, language, version) => {
  try {
    if (!codeExecutionQueue.has(roomId)) {
      codeExecutionQueue.set(roomId, []);
    }

    return new Promise((resolve) => {
      codeExecutionQueue.get(roomId).push(async () => {
        try {
          const response = await axios.post(
            "https://emkc.org/api/v2/piston/execute",
            {
              language,
              version,
              files: [{ content: code }],
            },
            { timeout: 5000 }
          );
          resolve(response.data);
        } catch (error) {
          console.error("Execution error:", error.message);
          resolve({
            run: { output: `Error: ${error.response?.data?.message || error.message}` }
          });
        } finally {
          // Process next in queue after delay
          setTimeout(() => {
            codeExecutionQueue.get(roomId).shift();
            if (codeExecutionQueue.get(roomId).length > 0) {
              codeExecutionQueue.get(roomId)[0]();
            }
          }, 250); // Slightly more than 200ms to be safe
        }
      });

      // Start processing if this is the only item in queue
      if (codeExecutionQueue.get(roomId).length === 1) {
        codeExecutionQueue.get(roomId)[0]();
      }
    });
  } catch (error) {
    return { run: { output: `System error: ${error.message}` } };
  }
};

io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(currentUser);
        if (rooms.get(currentRoom).size === 0) {
          rooms.delete(currentRoom);
        } else {
          io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
        }
      }
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Set(),
        code: "// start coding here...",
        language: "javascript"
      });
    }

    const room = rooms.get(roomId);
    room.users.add(userName);

    io.to(roomId).emit("userJoined", Array.from(room.users));
    socket.emit("codeUpdate", room.code);
    socket.emit("languageUpdate", room.language);
  });

  socket.on("codeChange", ({ roomId, code }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).code = code;
      socket.to(roomId).emit("codeUpdate", code);
    }
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).language = language;
      io.to(roomId).emit("languageUpdate", language);
    }
  });

  socket.on("compileCode", async ({ code, roomId, language, version }) => {
    if (rooms.has(roomId)) {
      try {
        const result = await executeCode(roomId, code, language, version);
        io.to(roomId).emit("codeResponse", result);
      } catch (error) {
        io.to(roomId).emit("codeResponse", {
          run: { output: `Execution failed: ${error.message}` }
        });
      }
    }
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users.delete(currentUser);
      
      if (room.users.size === 0) {
        rooms.delete(currentRoom);
        codeExecutionQueue.delete(currentRoom);
      } else {
        io.to(currentRoom).emit("userJoined", Array.from(room.users));
      }
      
      socket.leave(currentRoom);
      currentRoom = null;
      currentUser = null;
    }
  });

  socket.on("disconnect", () => {
    if (currentRoom && currentUser && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users.delete(currentUser);
      
      if (room.users.size === 0) {
        rooms.delete(currentRoom);
        codeExecutionQueue.delete(currentRoom);
      } else {
        io.to(currentRoom).emit("userJoined", Array.from(room.users));
      }
    }
    console.log("User Disconnected", socket.id);
  });
});

app.use(express.static(path.join(__dirname, "frontend", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});