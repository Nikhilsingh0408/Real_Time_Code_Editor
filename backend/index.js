import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";
//import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();
const codeExecutionQueue = new Map();

const DEFAULT_CODE = {
  javascript: "// Write your JavaScript code here\nconsole.log('Hello World!');",
  python: "# Write your Python code here\nprint('Hello World!')",
  java: "// Write your Java code here\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello World!\");\n  }\n}",
  cpp: "// Write your C++ code here\n#include <iostream>\n\nint main() {\n  std::cout << \"Hello World!\" << std::endl;\n  return 0;\n}"
};

const executeCode = async (roomId, code, language, version, input) => {
  try {
    if (!codeExecutionQueue.has(roomId)) {
      codeExecutionQueue.set(roomId, []);
    }

    return new Promise((resolve) => {
      codeExecutionQueue.get(roomId).push(async () => {
        try {
          // For Java and C++, remove surrounding quotes from string inputs
          let processedInput = input;
          if ((language === 'java' || language === 'cpp') && /^".*"$/.test(input)) {
            processedInput = input.slice(1, -1);
          }

          const response = await axios.post(
            "https://emkc.org/api/v2/piston/execute",
            {
              language,
              version,
              files: [{ content: code }],
              stdin: processedInput || "",
            },
            { timeout: 5000 }
          );

          // For string outputs in Java/C++, add quotes back for display
          let output = response.data.run.output;
          if ((language === 'java' || language === 'cpp') && 
              !/^\d+$/.test(output.trim()) && 
              output.trim() !== "" && 
              !/^".*"$/.test(output.trim())) {
            output = `"${output.trim()}"`;
          }

          resolve({
            run: {
              ...response.data.run,
              output: output
            }
          });
        } catch (error) {
          console.error("Execution error:", error.message);
          resolve({
            run: { output: `Error: ${error.response?.data?.message || error.message}` }
          });
        } finally {
          setTimeout(() => {
            codeExecutionQueue.get(roomId).shift();
            if (codeExecutionQueue.get(roomId).length > 0) {
              codeExecutionQueue.get(roomId)[0]();
            }
          }, 250);
        }
      });

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
        rooms.get(currentRoom).users.delete(currentUser);
        if (rooms.get(currentRoom).users.size === 0) {
          rooms.delete(currentRoom);
        } else {
          io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom).users));
        }
      }
    }

    currentRoom = roomId;
    currentUser = userName;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Set(),
        code: DEFAULT_CODE.javascript,
        language: "javascript",
        input: ""
      });
    }

    const room = rooms.get(roomId);
    room.users.add(userName);

    // Send initial state to the new user only
    socket.emit("initialState", {
      code: room.code,
      language: room.language,
      input: room.input,
      users: Array.from(room.users)
    });

    // Notify other users about the new user
    socket.to(roomId).emit("userJoined", Array.from(room.users));
  });

  socket.on("codeChange", ({ roomId, code }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).code = code;
      socket.to(roomId).emit("codeUpdate", code);
    }
  });

  socket.on("inputChange", ({ roomId, input }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).input = input;
      socket.to(roomId).emit("inputUpdate", input);
    }
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).language = language;
      rooms.get(roomId).code = DEFAULT_CODE[language] || "";
      io.to(roomId).emit("languageUpdate", language);
      io.to(roomId).emit("codeUpdate", rooms.get(roomId).code);
    }
  });

  socket.on("compileCode", async ({ code, roomId, language, version, input }) => {
    if (rooms.has(roomId)) {
      try {
        const result = await executeCode(roomId, code, language, version, input);
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

const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "frontend", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

// app.use(express.static(path.join(__dirname, "frontend", "dist")));
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
// });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});