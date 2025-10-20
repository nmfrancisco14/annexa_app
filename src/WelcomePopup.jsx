import React, { useState, useEffect } from "react";

const WelcomePopup = () => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Show popup only once per visit
    if (localStorage.getItem("popupShown")) {
      setShow(false);
    } else {
      setShow(true);
      localStorage.setItem("popupShown", "true");
    }
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "white",
          padding: "2rem",
          borderRadius: "1rem",
          maxWidth: "700px",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 5px 20px rgba(0,0,0,0.3)",
        }}
      >
        <h2>🐾 Staff ANNEX A Generator</h2>
        <p><i>"I'm not even sure I really need this web app, but I built it anyway."</i></p>

        <p>
          Though wala akong spare time, I used my <b>procrastination powers</b> to delay
          real deadlines and create this app para magawa ko ang <b>ANNEX A</b> ng team. YEY 🎉
        </p>

        <h3>📘 Instructions</h3>
        <p>
          By default, TORs for <b>January–June 2026</b> are preloaded.
          Select your name to view your TOR table, and download it as Word or Excel.
        </p>

        <ul>
          <li>✅ Download Word File → for Rain 😅</li>
          <li>✅ Download Excel File → for your edits</li>
        </ul>

        <h4>📤 Upload your own TOR file</h4>
        <p>
          Accepts <b>XLS/XLSX</b> with variables:
          Staff/Position, MFO, Major Category, Task, E, Q, T, Areas, Charging Code.
        </p>

        <h4>🐱 Random Cats</h4>
        <p>
          Expect random cats everywhere. They’re not useful, but they’re cute.
        </p>

        <button
          onClick={() => setShow(false)}
          style={{
            backgroundColor: "#2d6cdf",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            marginTop: "1rem",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default WelcomePopup;
