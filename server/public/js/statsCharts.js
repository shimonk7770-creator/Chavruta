// server/public/js/statsCharts.js
// שני גרפי D3.js בעמוד "בית המדרש האישי" (FR-025, FR-026) + מצבי ריקים ידידותיים (FR-027)
// נטען כ-<script> רגיל (D3 מ-CDN, לא React) - מצייר ישירות ל-SVG בתוך ה-div המתאים

(function () {
  const PRIMARY = "#c97b3c";
  const SECONDARY = "#1f6f5c";

  function showEmptyState(containerId, message) {
    d3.select(containerId).selectAll("*").remove();
    d3.select(containerId).append("p").attr("class", "meta chart-empty").text(message);
  }

  // FR-025: גרף עמודות - פעילות (כמות פוסטים) לפי קבוצה
  function drawPostsPerGroup(data) {
    const containerId = "#chart-posts-per-group";
    if (!data.length) {
      showEmptyState(containerId, "עדיין אין מספיק פוסטים בקבוצות כדי להציג גרף פעילות.");
      return;
    }

    const width = 560,
      height = 260,
      margin = { top: 20, right: 20, bottom: 70, left: 40 };
    const svg = d3.select(containerId).append("svg").attr("viewBox", "0 0 " + width + " " + height).attr("width", "100%");

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.groupName))
      .range([margin.left, width - margin.right])
      .padding(0.25);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg
      .append("g")
      .attr("transform", "translate(0," + (height - margin.bottom) + ")")
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end")
      .style("font-family", "Heebo, Arial");

    svg.append("g").attr("transform", "translate(" + margin.left + ",0)").call(d3.axisLeft(y).ticks(5));

    svg
      .selectAll("rect.bar")
      .data(data)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.groupName))
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - margin.bottom - y(d.count))
      .attr("fill", PRIMARY)
      .attr("rx", 4);

    // תוויות מספר מעל כל עמודה - עוזר לקרוא ערכים מדויקים גם בלי hover
    svg
      .selectAll("text.bar-label")
      .data(data)
      .join("text")
      .attr("class", "bar-label")
      .attr("x", (d) => x(d.groupName) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.count) - 6)
      .attr("text-anchor", "middle")
      .style("font-size", "0.75rem")
      .style("font-family", "Heebo, Arial")
      .text((d) => d.count);
  }

  // FR-026: גרף קו - מגמת רישומי לימוד קהילתיים ב-30 הימים האחרונים
  function drawLearningTrend(data) {
    const containerId = "#chart-learning-trend";
    if (!data.length) {
      showEmptyState(containerId, 'עדיין אין מספיק רישומי לימוד כדי להציג מגמה - התחילו לתעד ב"מעקב לימוד"!');
      return;
    }

    const parsed = data.map((d) => ({ date: new Date(d.date), count: d.count }));
    const width = 560,
      height = 260,
      margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const svg = d3.select(containerId).append("svg").attr("viewBox", "0 0 " + width + " " + height).attr("width", "100%");

    const x = d3.scaleTime().domain(d3.extent(parsed, (d) => d.date)).range([margin.left, width - margin.right]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(parsed, (d) => d.count) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg
      .append("g")
      .attr("transform", "translate(0," + (height - margin.bottom) + ")")
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%d/%m")));
    svg.append("g").attr("transform", "translate(" + margin.left + ",0)").call(d3.axisLeft(y).ticks(5));

    const line = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    svg.append("path").datum(parsed).attr("fill", "none").attr("stroke", SECONDARY).attr("stroke-width", 2.5).attr("d", line);

    svg
      .selectAll("circle")
      .data(parsed)
      .join("circle")
      .attr("cx", (d) => x(d.date))
      .attr("cy", (d) => y(d.count))
      .attr("r", 3.5)
      .attr("fill", SECONDARY);
  }

  function loadAndDraw(url, containerId, drawFn) {
    fetch(url)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) drawFn(res.data);
        else showEmptyState(containerId, "שגיאה בטעינת נתוני הגרף");
      })
      .catch(() => showEmptyState(containerId, "שגיאה בתקשורת עם השרת"));
  }

  loadAndDraw("/api/stats/posts-per-group", "#chart-posts-per-group", drawPostsPerGroup);
  loadAndDraw("/api/stats/learning-trend", "#chart-learning-trend", drawLearningTrend);
})();
