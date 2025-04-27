import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import { FiMenu, FiX, FiCopy, FiRefreshCw } from "react-icons/fi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const socket = io("http://localhost:5000", {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start coding here...");
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [output, setOutput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const typingDebounceRef = useRef(null);

  // Generate room ID on first render
  useEffect(() => {
    setRoomId(generateRoomId());
  }, []);

  useEffect(() => {
    const handleUserJoined = (users) => setUsers(users);
    const handleCodeUpdate = (newCode) => setCode(newCode);
    const handleUserTyping = (user) => {
      setTypingUsers(prev => {
        if (!prev.includes(user)) {
          return [...prev, user];
        }
        return prev;
      });

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u !== user));
      }, 2000);
    };
    const handleLanguageUpdate = (newLanguage) => setLanguage(newLanguage);
    const handleCodeResponse = (response) => {
      setOutput(response.run.output);
      setIsExecuting(false);
      toast.success("Code executed successfully!");
    };

    socket.on("userJoined", handleUserJoined);
    socket.on("codeUpdate", handleCodeUpdate);
    socket.on("userTyping", handleUserTyping);
    socket.on("languageUpdate", handleLanguageUpdate);
    socket.on("codeResponse", handleCodeResponse);

    return () => {
      socket.off("userJoined", handleUserJoined);
      socket.off("codeUpdate", handleCodeUpdate);
      socket.off("userTyping", handleUserTyping);
      socket.off("languageUpdate", handleLanguageUpdate);
      socket.off("codeResponse", handleCodeResponse);
      clearTimeout(typingTimeoutRef.current);
      clearTimeout(typingDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const joinRoom = () => {
    if (roomId.trim() && userName.trim()) {
      socket.emit("join", { roomId, userName });
      setJoined(true);
      toast.success(`Joined room ${roomId}`);
    } else {
      toast.error("Please enter both room ID and your name");
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId(generateRoomId());
    setUserName("");
    setCode("// start coding here...");
    setLanguage("javascript");
    setOutput("");
    toast.info("Left the room");
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { roomId, userName });
    }

    clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("codeChange", { roomId, code: newCode });
    }, 500);
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit("languageChange", { roomId, language: newLanguage });
  };

  const runCode = () => {
    if (!isExecuting) {
      setIsExecuting(true);
      socket.emit("compileCode", {
        code,
        roomId,
        language,
        version: "*"
      });
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success("Room ID copied to clipboard!");
  };

  const generateNewRoomId = () => {
    const newId = generateRoomId();
    setRoomId(newId);
    toast.info(`New Room ID: ${newId}`);
  };

  const getTypingMessage = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers.join(' and ')} are typing...`;
    return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
  };

  if (!joined) {
    return (
      <div className="join-container">
        <ToastContainer position="top-center" autoClose={3000} />
        <div className="join-form">
          <h1>Join Code Room</h1>
          <div className="input-group">
            <input
              type="text"
              placeholder="Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
            />
            <button
              className="generate-btn"
              onClick={generateNewRoomId}
              title="Generate new Room ID"
            >
              <FiRefreshCw className="icon" />
            </button>
          </div>
          <div className="input-group">
            <input
              type="text"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </div>
          <button className="join-btn" onClick={joinRoom}>
            Join Room
          </button>
          <p className="room-id-note">
            A Room ID has been generated for you. Feel free to use this or create your own.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <ToastContainer position="top-right" autoClose={3000} />
      <button className="menu-toggle" onClick={toggleSidebar}>
        {sidebarOpen ? <FiX className="icon" /> : <FiMenu className="icon" />}
      </button>

      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <button className="copy-btn" onClick={copyRoomId}>
            <FiCopy className="icon" /> Copy ID
          </button>
        </div>

        <div className="users-section">
          <h3>Users ({users.length})</h3>
          <ul className="users-list">
            {users.map((user, idx) => (
              <li key={idx} className={user === userName ? "current-user" : ""}>
                <span className="user-badge"></span>
                {user} {user === userName && "(You)"}
              </li>
            ))}
          </ul>
        </div>

        {getTypingMessage() && (
          <div className="typing-indicator">
            {getTypingMessage()}
          </div>
        )}

        <select
          value={language}
          onChange={handleLanguageChange}
          className="language-select"
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        <button className="leave-btn" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      <div className="editor-wrapper">
        <Editor
          height="60%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
          }}
          loading={<div className="editor-loading">Loading Editor...</div>}
        />

        <div className="controls">
          <button
            className="run-btn"
            onClick={runCode}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <span className="spinner">Executing...</span>
            ) : (
              "Run Code"
            )}
          </button>
        </div>

        <div className="output-console">
          <h4>Output:</h4>
          <pre>{output || "Output will appear here..."}</pre>
        </div>
      </div>
    </div>
  );
};

export default App;