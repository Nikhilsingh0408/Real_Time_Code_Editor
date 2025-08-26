# 🚀 CodeSync – Real-Time Collaborative Code Editor
---

## 📖 Overview
**CodeSync** is a **real-time collaborative code editor** that allows multiple users to edit code simultaneously within a shared room. It leverages **WebSockets (Socket.IO)** for instant synchronization and **CodeMirror** for syntax highlighting, providing a seamless pair-programming and collaborative development experience.

---

## 📸 Screenshots

### 🏠 Homepage / Room Creation
![Homepage Screenshot](https://github.com/user-attachments/assets/bb84ce6c-f856-40f8-af3d-9950d1c1fa12) 
*Users can create or join a coding room with a unique ID.*

### 👨‍💻 Real-Time Editor
![Editor Screenshot](https://github.com/user-attachments/assets/22e136e2-ec81-483c-bd5d-63c72aa8ee2f)  
*Collaborative editor with syntax highlighting and live synchronization.*

### 👥 Multi-User Collaboration
![Multiple Users Screenshot](https://github.com/user-attachments/assets/873597b2-324a-4bd3-a036-21cf3fe91d91)  
*Multiple participants coding together in real-time.*

---

## ✨ Features
- 📝 **Real-time synchronization** of code across multiple clients  
- 👥 **Room-based collaboration** using unique IDs  
- 🎨 **Syntax highlighting** for multiple programming languages  
- 🖱 **Live cursor movement tracking**  
- 📱 **Responsive UI** with Tailwind CSS  

---

## 🛠️ Project Flow

The working of **CodeSync** can be understood in three main steps:

1. **Room Creation / Joining**  
   - A user can create a new room or join an existing one using a unique Room ID.  
   - This Room ID ensures that only participants with the same ID are synchronized.

2. **Real-Time Collaboration**  
   - When one user types, **Socket.IO** broadcasts the changes to all other users in the same room.  
   - Cursor positions and code updates are instantly reflected in every participant’s editor.  

3. **Code Editing Interface**  
   - The frontend uses **CodeMirror** for the editor, providing syntax-aware highlighting.  
   - The UI is kept clean and responsive with **Tailwind CSS** for smooth collaboration.  

---


## 📂 System Architecture

```text
                ┌──────────────┐
                │   React.js    │
                │  + CodeMirror │
                └───────┬──────┘
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
   Socket.io          REST API         WebSocket
 (Code Sync)        (Compile)          (Broadcast)
     │                  │                  │
 ┌───▼───┐       ┌─────▼─────┐       ┌────▼─────┐
 │Socket │       │ Express.js │       │ Piston   │
 │Server │       │  Backend   │       │  API     │
 └───▲───┘       └─────┬─────┘       └──────────┘
     │                 │
   Updates        Execution Req
     │                 │
 ┌───▼─────────────────▼───┐
 │       Multiple Users     │
 │ (Real-time Collaboration)│
 └──────────────────────────┘

```
---

## 📂 File Structure

```text
CodeSync-Real-Time-Code-Editor/
│
├── frontend/                     # React.js frontend
│   ├── public/                   # Static files (index.html, favicon, etc.)
│   └── src/
│       ├── components/           # Reusable UI components (Editor, Navbar, RoomJoin, etc.)
│       ├── pages/                # Page-level components (HomePage, EditorPage, etc.)
│       ├── utils/                # Helper functions and constants
│       ├── App.js                # Main app component
│       └── index.js              # Entry point for React app
│
├── backend/                      # Node.js + Express + Socket.IO backend
│   ├── server.js                 # Main server file, initializes Express and Socket.IO
│   ├── socket/                   # Socket.IO event handling (room join, code sync, cursor updates)
│   ├── utils/                    # Utility functions (room management, broadcasting, etc.)
│   └── package.json              # Backend dependencies
│
├── screenshots/                  # Screenshots used in README
│   ├── home.png
│   ├── editor.png
│   └── multi-users.png
│
├── LICENSE                       # License file (MIT)
└── README.md                     # Project documentation

```

---

## 🔮 Future Enhancements
- Code execution using **Piston API**  
- Persistent code storage (MongoDB/Redis)  
- Authentication & user roles  
- Built-in chat for communication  

---
---

⭐ If you found this project interesting, please **star the repository**!
