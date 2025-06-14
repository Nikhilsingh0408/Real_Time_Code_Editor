import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import { FiMenu, FiX, FiCopy, FiRefreshCw, FiCode, FiTerminal, FiPlay } from "react-icons/fi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const socket = io("https://real-time-code-editor-2-1h4l.onrender.com", {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  //transports: ["websocket"]
});

const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const INPUT_VALIDATORS = {
  javascript: (input) => ({ valid: true, message: "" }),
  python: (input) => ({ valid: true, message: "" }),
  java: (input) => {
    if (input.trim() === "") return { valid: true, message: "" };
    if (/^[\d\s]+$/.test(input)) return { valid: true, message: "" };
    if (/^".*"$/.test(input)) return { valid: true, message: "" };
    return { 
      valid: false, 
      message: "Java input should be numbers or strings in double quotes" 
    };
  },
  cpp: (input) => {
    if (input.trim() === "") return { valid: true, message: "" };
    if (/^[\d\s]+$/.test(input)) return { valid: true, message: "" };
    if (/^".*"$/.test(input)) return { valid: true, message: "" };
    return { 
      valid: false, 
      message: "C++ input should be numbers or strings in double quotes" 
    };
  }
};

const DEFAULT_CODE = {
  javascript: "// Write your JavaScript code here\nconsole.log('Hello World!');",
  python: "# Write your Python code here\nprint('Hello World!')",
  java: "// Write your Java code here\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello World!\");\n  }\n}",
  cpp: "// Write your C++ code here\n#include <iostream>\n\nint main() {\n  std::cout << \"Hello World!\" << std::endl;\n  return 0;\n}"
};

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(DEFAULT_CODE.javascript);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [output, setOutput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [activeTab, setActiveTab] = useState("input");
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const typingTimeoutRef = useRef(null);
  const typingDebounceRef = useRef(null);

  useEffect(() => {
    setRoomId(generateRoomId());
    
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleInitialState = ({ code: initialCode, language: initialLanguage, input: initialInput, users: roomUsers }) => {
      if (initialCode) setCode(initialCode);
      if (initialLanguage) setLanguage(initialLanguage);
      if (initialInput !== undefined) setUserInput(initialInput);
      if (roomUsers) setUsers(roomUsers);
    };

    const handleCodeUpdate = (newCode) => setCode(newCode);
    const handleUserJoined = (roomUsers) => setUsers(roomUsers);
    const handleUserTyping = (user) => {
      setTypingUsers(prev => [...prev.filter(u => u !== user), user]);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u !== user));
      }, 2000);
    };
    const handleLanguageUpdate = (newLanguage) => {
      setLanguage(newLanguage);
      setCode(DEFAULT_CODE[newLanguage] || "");
    };
    const handleCodeResponse = (response) => {
      setOutput(response.run.output);
      setIsExecuting(false);
      setActiveTab("output");
      toast.success("Code executed successfully!");
    };
    const handleInputUpdate = (newInput) => {
      setUserInput(newInput);
      validateInput(newInput);
    };

    socket.on("initialState", handleInitialState);
    socket.on("codeUpdate", handleCodeUpdate);
    socket.on("userJoined", handleUserJoined);
    socket.on("userTyping", handleUserTyping);
    socket.on("languageUpdate", handleLanguageUpdate);
    socket.on("codeResponse", handleCodeResponse);
    socket.on("inputUpdate", handleInputUpdate);

    return () => {
      socket.off("initialState", handleInitialState);
      socket.off("codeUpdate", handleCodeUpdate);
      socket.off("userJoined", handleUserJoined);
      socket.off("userTyping", handleUserTyping);
      socket.off("languageUpdate", handleLanguageUpdate);
      socket.off("codeResponse", handleCodeResponse);
      socket.off("inputUpdate", handleInputUpdate);
      clearTimeout(typingTimeoutRef.current);
      clearTimeout(typingDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const validateInput = (input) => {
    const { valid, message } = INPUT_VALIDATORS[language](input);
    setInputError(valid ? "" : message);
    return valid;
  };

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
    setCode(DEFAULT_CODE[language] || "");
    setLanguage("javascript");
    setOutput("");
    setUserInput("");
    setInputError("");
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
    setCode(DEFAULT_CODE[newLanguage] || "");
    validateInput(userInput);
    socket.emit("languageChange", { roomId, language: newLanguage });
  };

  const handleInputChange = (e) => {
    const newInput = e.target.value;
    setUserInput(newInput);
    validateInput(newInput);
    socket.emit("inputChange", { roomId, input: newInput });
  };

  const runCode = () => {
    if (inputError) {
      toast.error("Please fix input errors before running");
      return;
    }
    if (!isExecuting) {
      setIsExecuting(true);
      socket.emit("compileCode", {
        code,
        roomId,
        language,
        version: "*",
        input: userInput,
      });
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
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
            <button className="generate-btn" onClick={generateNewRoomId}>
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
            A Room ID has been generated for you
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <ToastContainer position="top-right" autoClose={3000} />
      
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
          <div className="typing-indicator">{getTypingMessage()}</div>
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
        <button className="menu-toggle" onClick={toggleSidebar}>
          {sidebarOpen ? <FiX className="icon" /> : <FiMenu className="icon" />}
        </button>

        <Editor
          height={windowWidth <= 768 ? "calc(50% - 5px)" : "60%"}
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

        <div className="io-tabs">
          <button 
            className={`io-tab ${activeTab === "input" ? "active" : ""}`}
            onClick={() => setActiveTab("input")}
          >
            <FiCode className="icon" /> Input
          </button>
          <button 
            className={`io-tab ${activeTab === "output" ? "active" : ""}`}
            onClick={() => setActiveTab("output")}
          >
            <FiTerminal className="icon" /> Output
          </button>
          <button 
            className="run-btn"
            onClick={runCode}
            disabled={isExecuting || !!inputError}
          >
            {isExecuting ? (
              <span className="spinner">Executing...</span>
            ) : (
              <>
                <FiPlay className="icon" /> Run
              </>
            )}
          </button>
        </div>

        <div className="io-container">
          {activeTab === "input" && (
            <div className="input-section">
              <textarea
                className={`input-console ${inputError ? "error" : ""}`}
                value={userInput}
                onChange={handleInputChange}
                placeholder={`Enter input (${language} format)...`}
              />
              {inputError && <div className="input-error">{inputError}</div>}
              <div className="input-hint">
                {language === 'java' || language === 'cpp' ? 
                  'Enter numbers or strings in double quotes (e.g., 42 or "hello")' : 
                  'Any input is valid'}
              </div>
            </div>
          )}

          {activeTab === "output" && (
            <div className="output-section">
              <pre className="output-console">{output || "Output will appear here..."}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
