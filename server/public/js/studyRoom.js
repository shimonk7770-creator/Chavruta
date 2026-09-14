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

// "הרכבת" (mount) קומפוננטת ה-React לתוך ה-div שהוכן ב-studyRoom.ejs
const root = ReactDOM.createRoot(document.getElementById("study-room-root"));
root.render(<LearningHeatmap />);
