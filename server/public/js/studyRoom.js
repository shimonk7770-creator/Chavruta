// server/public/js/studyRoom.js
// קומפוננטת React ל"בית המדרש האישי" - מציגה heatmap של מעקב הלימוד האישי בעזרת Canvas (FR-020)
// נטען כ-<script type="text/babel"> - הדפדפן מתרגם JSX "on the fly" דרך Babel Standalone, בלי שלב build

const { useState, useEffect, useRef } = React;

// --- הגדרות עיצוב ה-heatmap ---
const WEEKS_TO_SHOW = 26; // חצי שנה אחורה
const CELL_SIZE = 14;
const CELL_GAP = 3;
// צבעים לפי כמות רישומי לימוד באותו יום (0 = בהיר ביותר, 3+ = כהה ביותר)
const COLORS = ["#efe7da", "#e3c9a3", "#c97b3c", "#a85f27", "#7a4419"];

function LearningHeatmap() {
  // counts: מיפוי מתאריך (YYYY-MM-DD) למספר יחידות לימוד שנרשמו באותו יום
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  // שליפת הנתונים מהשרת - דרך ה-API שכתבנו ב-learningLogController.heatmapData
  useEffect(() => {
    fetch("/api/learning/heatmap")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCounts(data.counts);
        else setError("שגיאה בטעינת נתוני הלימוד");
      })
      .catch(() => setError("שגיאה בתקשורת עם השרת"));
  }, []);

  // ציור ה-heatmap על ה-Canvas בכל פעם שהנתונים מוכנים/משתנים
  useEffect(() => {
    if (!counts || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = (WEEKS_TO_SHOW + 1) * (CELL_SIZE + CELL_GAP);
    const height = 7 * (CELL_SIZE + CELL_GAP) + 20;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    // בונים רשימת ימים - מהיום אחורה WEEKS_TO_SHOW*7 ימים, מיושרים לתחילת שבוע (ראשון)
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - WEEKS_TO_SHOW * 7);
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1); // מיישרים ליום ראשון

    let lastMonth = -1;
    for (let week = 0; week < WEEKS_TO_SHOW + 1; week++) {
      for (let day = 0; day < 7; day++) {
        const cellDate = new Date(start);
        cellDate.setDate(cellDate.getDate() + week * 7 + day);
        if (cellDate > today) continue;

        const key = cellDate.toISOString().slice(0, 10);
        const count = counts[key] || 0;
        const colorIndex = Math.min(count, COLORS.length - 1);

        // ממשק RTL - עמודת השבוע הראשונה (החדשה ביותר) מוצגת מימין
        const x = width - (week + 1) * (CELL_SIZE + CELL_GAP);
        const y = 20 + day * (CELL_SIZE + CELL_GAP);

        ctx.fillStyle = COLORS[colorIndex];
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // תווית חודש קצרה כשמתחיל חודש חדש (עוזר להתמצא בציר הזמן)
        if (day === 0 && cellDate.getMonth() !== lastMonth) {
          lastMonth = cellDate.getMonth();
          ctx.fillStyle = "#6b6259";
          ctx.font = "11px Heebo, Arial";
          ctx.fillText(cellDate.toLocaleDateString("he-IL", { month: "short" }), x, 12);
        }
      }
    }
  }, [counts]);

  if (error) return <p className="error-message">{error}</p>;
  if (!counts) return <p>טוען נתוני לימוד...</p>;

  const totalDays = Object.keys(counts).length;

  return (
    <div>
      <canvas ref={canvasRef} style={{ maxWidth: "100%" }}></canvas>
      <p className="meta" style={{ marginTop: "0.8rem" }}>
        סך הכל למדת ב-{totalDays} ימים שונים בחצי השנה האחרונה.
      </p>
      <div style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "0.8rem" }}>
        <span>פחות</span>
        {COLORS.map((c, i) => (
          <span key={i} style={{ width: 12, height: 12, background: c, display: "inline-block", borderRadius: 2 }}></span>
        ))}
        <span>יותר</span>
      </div>
    </div>
  );
}

// ============================================================================
// דרישה 26 (React + Video + Canvas): נגן וידאו שנשלט כולו ע"י React - "הספרייה שלי"
// שונה במהותו מהוידאו שמוטמע בפוסטים דרך EJS (שם זה <video controls> רגיל של הדפדפן) -
// כאן ה-state, הכפתורים וההתקדמות מנוהלים ב-React (useState+useRef), וה-<video> עצמו
// בלי controls מובנים כלל - זה מה שסוגר את הפער בין "יש קובץ וידאו באתר" ל"רכיב React עם Video".
// ============================================================================
function VideoLibrary() {
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const videoRef = useRef(null);

  useEffect(() => {
    fetch("/api/videos/library")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setVideos(data.videos);
        else setError("שגיאה בטעינת ספריית הוידאו");
      })
      .catch(() => setError("שגיאה בתקשורת עם השרת"));
  }, []);

  // כל פעם שעוברים לסרטון אחר - מאפסים את מצב הנגינה ומתחילים מהתחלה
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [selected]);

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }

  function onSeek(e) {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  }

  function toggleMute() {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  function changeRate(newRate) {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = newRate;
    setRate(newRate);
  }

  function formatTime(sec) {
    if (!Number.isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  if (error) return <p className="error-message">{error}</p>;
  if (!videos) return <p>טוען ספריית וידאו...</p>;
  if (!videos.length) return <p className="meta">עדיין לא צורפו קטעי וידאו לפוסטים באתר.</p>;

  const current = videos[selected];

  return (
    <div className="video-library">
      <div className="video-library-list">
        {videos.map((v, i) => (
          <button
            key={v.id}
            type="button"
            className={"video-library-item" + (i === selected ? " active" : "")}
            onClick={() => setSelected(i)}
          >
            {v.title}
            <span className="meta"> · {v.groupName}</span>
          </button>
        ))}
      </div>

      <div className="video-player-shell">
        {/* בלי controls מובנה בכוונה - כל השליטה למטה מנוהלת ע"י React */}
        <video
          key={current.id}
          ref={videoRef}
          src={current.videoUrl}
          className="video-player-el"
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onEnded={() => setIsPlaying(false)}
        ></video>

        <div className="video-player-controls">
          <button type="button" className="btn btn-secondary" onClick={togglePlay}>
            {isPlaying ? "⏸ השהיה" : "▶ נגינה"}
          </button>
          <span className="meta">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={onSeek}
            className="video-seek"
          />
          <button type="button" className="btn btn-secondary" onClick={toggleMute}>
            {muted ? "🔇" : "🔊"}
          </button>
          <select value={rate} onChange={(e) => changeRate(Number(e.target.value))}>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
        <p className="meta">מתוך: {current.title} ({current.authorName})</p>
      </div>
    </div>
  );
}

// "הרכבת" (mount) קומפוננטות ה-React לתוך ה-div-ים שהוכנו ב-studyRoom.ejs
const root = ReactDOM.createRoot(document.getElementById("study-room-root"));
root.render(<LearningHeatmap />);

const videoRoot = ReactDOM.createRoot(document.getElementById("video-library-root"));
videoRoot.render(<VideoLibrary />);
