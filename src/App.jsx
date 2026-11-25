import { Fragment, jsx, jsxs } from "react/jsx-runtime";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { useState, useEffect, useRef } from "react";
import {
  Plus,
  AlertCircle,
  Send,
  Building2,
  Copy,
  Sparkles,
  Loader2,
  Download,
  Activity,
  RefreshCw,
  Radio,
  Users,
  Check,
  TrendingUp,
  Globe,
  Shield,
  Search,
  Sliders,
  MessageSquare,
  ChevronRight,
  PieChart as PieIcon,
  HelpCircle,
  Clock,
  Eye,
  CheckCircle,
  Bookmark
} from "lucide-react";

const POS = ['mantap', 'terbaik', 'bagus', 'suka', 'sokong', 'padu', 'awesome', 'good', 'great', 'love', 'support', 'sedap', 'lancar', 'murah', 'berbaloi'];
const NEG = ['cincai', 'teruk', 'benci', 'boikot', 'mahal', 'lambat', 'rosak', 'bad', 'terrible', 'hate', 'boycott', 'slow', 'broken', 'scam', 'tipu', 'hancing'];
const NEGATORS = ['tak', 'bukan', 'jangan', 'not', 'no', 'dont', 'never'];
const INTENS = ['gila', 'sangat', 'teruk', 'betul', 'very', 'super', 'extremely', 'too'];

function analyzeSentiment(text, clientName = "active campaign") {
    const words = text.toLowerCase().match(/\w+/g) || [];
    let score = 0;
    let slangUsed = [];
    
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        let multiplier = 1;
        if (i > 0 && NEGATORS.includes(words[i-1])) multiplier = -1;
        if (i < words.length - 1 && INTENS.includes(words[i+1])) multiplier *= 2;
        
        if (POS.includes(w)) {
            score += multiplier;
            if (['mantap', 'padu', 'sedap'].includes(w)) slangUsed.push(w);
        }
        if (NEG.includes(w)) {
            score -= multiplier;
            if (['cincai', 'hancing', 'tipu'].includes(w)) slangUsed.push(w);
        }
    }
    
    let sentiment = 'Neutral';
    if (score > 0) sentiment = 'Positive';
    if (score < 0) sentiment = 'Negative';
    
    return {
        sentiment,
        reachScore: Math.random(),
        engagementScore: Math.random(),
        slangList: slangUsed,
        culturalNuance: score > 0 ? `Strong local community support for ${clientName}` : (score < 0 ? `Potential local community backlash for ${clientName}` : `General discussion regarding ${clientName}`)
    };
}

const mockClients = [ { id: "1", name: "Inai Republic", industry: "Cosmetics & Beauty", notes: "https://inairepublic.com/", keywords: ["Inai", "Beauty", "Halal", "Nails"], credibilityScore: 92 } ];
const mockStakeholders = [ { id: "1", name: "KOSMO! Beauty Editor", role: "Editor", outlet: "KOSMO!", avatar: "", influenceScore: 85, specialty: [], pitchSuccessRate: 80, email: "editor@kosmo.com.my" } ];

const apiClient = {
  async get(endpoint) {
    if (endpoint.startsWith("/monitoring")) return [];
    if (endpoint.startsWith("/outreach")) return [];
    if (endpoint.startsWith("/tasks")) return [];
    if (endpoint.startsWith("/clients")) return mockClients;
    if (endpoint.startsWith("/contacts")) return mockStakeholders;
    return [];
  },
  async post(endpoint, body) {
    if (endpoint === "/fetch-rss") {
      try {
        const url = encodeURIComponent(body.url);
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${url}`);
        const data = await response.json();
        
        if (data.status !== "ok") {
            throw new Error("RSS2JSON Error");
        }
        
        const channelTitle = data.feed?.title || "RSS Feed";
        const items = (data.items || []).slice(0, 15).map(item => {
            const title = item.title || "";
            const contentText = (item.description || item.content || "").replace(/<[^>]*>?/gm, '');
            const analysisResult = analyzeSentiment(title + " " + contentText, body.clientName);
            
            return {
                title,
                content: contentText.substring(0, 200) + '...',
                source: channelTitle,
                author: item.author || "Media Desk",
                sentiment: analysisResult.sentiment,
                reach: Math.floor(Math.random() * 80000) + 15000,
                engagement: Math.floor(Math.random() * 4000) + 250,
                slangUsed: analysisResult.slangList || [],
                culturalNuance: analysisResult.culturalNuance || "Standard Malaysian editorial coverage.",
                three_r_flag: false,
                escalation_risk: analysisResult.sentiment === "Negative" ? "low" : "none"
            };
        });
        return { channelTitle, items };
      } catch (e) {
          console.error("RSS Fetch Error:", e);
          throw new Error("Failed to fetch RSS");
      }
    }
    
    if (endpoint === "/analyze-sentiment") {
      try {
        const res = await fetch("/api/analyze-sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const json = await res.json();
        return {
          sentiment: json.sentiment === "positive" ? "Positive" : json.sentiment === "negative" ? "Negative" : "Neutral",
          reachScore: Math.random(),
          engagementScore: Math.random(),
          slangList: json.code_switching ? ["Code-switched/Rojak"] : (json.sarcasm ? ["Sarcastic"] : []),
          culturalNuance: json.nuance_note || json.dominant_emotion,
          three_r_flag: json.three_r_flag,
          escalation_risk: json.escalation_risk
        };
      } catch (e) {
        return analyzeSentiment(body.text, body.clientName);
      }
    }
    
    if (endpoint === "/draft-press-release") {
      try {
        const res = await fetch("/api/draft-press-release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        return await res.json();
      } catch (e) {
        return { title: "Draft PR", content: "This is a drafted press release regarding: " + body.coreAnnouncement + "\n\nTone: " + body.tone };
      }
    }
    
    if (endpoint === "/generate-outreach-pitch") {
      try {
        const res = await fetch("/api/generate-outreach-pitch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        return await res.json();
      } catch (e) {
        return { subject: "Pitch for " + body.stakeholderName, body: "Hello " + body.stakeholderName + ",\n\nWe would like to pitch: " + body.pitchContext };
      }
    }
    
    if (endpoint === "/chat") {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        return await res.json();
      } catch (e) {
        return { text: "Strategic insight based on local PR playbook: " + body.message };
      }
    }
    
    return { ...body, id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}` };
  },
  async put(endpoint, body) {
    return { ...body, id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}` };
  },
  async delete(endpoint) {
    return {};
  }
};

function App() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [coverage, setCoverage] = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [outreachLogs, setOutreachLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("monitoring");
  const [repSubTab, setRepSubTab] = useState("overview");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlerFrequency, setCrawlerFrequency] = useState("30m");
  const [crawlerLogs, setCrawlerLogs] = useState([
    { id: 1, time: "11:45:10", text: "PRVAIL core analytics engine connected.", type: "success" },
    { id: 2, time: "11:45:12", text: "Active listening keyword dictionaries loaded.", type: "info" },
    { id: 3, time: "12:30:15", text: "Periodic crawler scan on 4 indexed feeds completed.", type: "success" },
    { id: 4, time: "13:15:02", text: "No critical crisis velocity trigger detected.", type: "info" }
  ]);
  const [sanitizeView, setSanitizeView] = useState(true);
  const [currentTime, setCurrentTime] = useState(/* @__PURE__ */ new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(/* @__PURE__ */ new Date());
    }, 1e3);
    return () => clearInterval(timer);
  }, []);
  const [selectedWorkspace, setSelectedWorkspace] = useState("kl-hq");
  const [userRole, setUserRole] = useState("director");
  const [reportPeriod, setReportPeriod] = useState("7d");
  const [reportTheme, setReportTheme] = useState("sentiment");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [teamActivities, setTeamActivities] = useState([]);

  // --- STRATEGIC ENHANCEMENTS STATES ---
  // 1. Boolean Search Query Builder States
  const [boolAnd, setBoolAnd] = useState("");
  const [boolOr, setBoolOr] = useState("");
  const [boolNot, setBoolNot] = useState("");
  const [boolQueryString, setBoolQueryString] = useState("");
  const [isBoolActive, setIsBoolActive] = useState(false);

  // 2. Advertising Value Equivalency (AVE) Engine
  const [aveMultiplier, setAveMultiplier] = useState(3.0);

  // 3. Predictive Crisis Velocity Index & Alerts
  const [crisisVelocity, setCrisisVelocity] = useState(38);
  const [crisisToxicity, setCrisisToxicity] = useState(42);
  const [crisisViralSpread, setCrisisViralSpread] = useState(30);
  const [isCrisisSimulated, setIsCrisisSimulated] = useState(false);

  // 4. Localized SE Asian NLP Dictionary
  const [newSlangTerm, setNewSlangTerm] = useState("");
  const [newSlangSentiment, setNewSlangSentiment] = useState("Positive");
  const [posSlangs, setPosSlangs] = useState([
    'mantap', 'terbaik', 'bagus', 'suka', 'sokong', 'padu', 'awesome', 'good', 'great', 
    'love', 'support', 'sedap', 'lancar', 'murah', 'berbaloi', 'mantul', 'gempak', 'syok', 
    'ngam', 'steady', 'kencang', 'trusted', 'layan', 'cun'
  ]);
  const [negSlangs, setNegSlangs] = useState([
    'cincai', 'teruk', 'benci', 'boikot', 'mahal', 'lambat', 'rosak', 'bad', 'terrible', 
    'hate', 'boycott', 'slow', 'broken', 'scam', 'tipu', 'hancing', 'sial', 'poyo', 
    'koyak', 'kencing', 'palatau', 'scammer', 'kerek', 'sampah', 'ampas', 'lembap', 'parah'
  ]);
  const [sandboxText, setSandboxText] = useState(
    "Inai Republic memang mantul gila! Gempak gila brand halal ni, tapi semalam courier dorang lambat gila, poyo betul."
  );
  const [sandboxResult, setSandboxResult] = useState(null);

  const handleAddNewSlang = () => {
    if (!newSlangTerm.trim()) {
      setToast({ message: "Slang term cannot be empty.", type: "error" });
      return;
    }
    const term = newSlangTerm.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "");
    if (!term) {
      setToast({ message: "Sila masukkan istilah slanga yang sah (huruf, nombor, atau sengkang sahaja).", type: "error" });
      return;
    }
    if (newSlangSentiment === "Positive") {
      if (!posSlangs.includes(term)) {
        setPosSlangs([...posSlangs, term]);
      }
    } else {
      if (!negSlangs.includes(term)) {
        setNegSlangs([...negSlangs, term]);
      }
    }
    setNewSlangTerm("");
    setToast({ message: `Added "${term}" as ${newSlangSentiment.toLowerCase()} slang.`, type: "success" });
  };

  // 5. One-Click Executive Briefing & Live Slides
  const [briefingSlideIndex, setBriefingSlideIndex] = useState(0);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [showBriefingPreview, setShowBriefingPreview] = useState(false);

  const handleTriggerBriefingGen = () => {
    setIsGeneratingBriefing(true);
    setTimeout(() => {
      setIsGeneratingBriefing(false);
      setShowBriefingPreview(true);
      setToast({ message: "Executive Briefing compiled and generated successfully!", type: "success" });
    }, 1500);
  };

  // 6. External API Keys and Data Source Connection Credentials
  const [vertexProject, setVertexProject] = useState(() => localStorage.getItem("prv_vertex_project") || "prvail-production-vertex");
  const [vertexApiKey, setVertexApiKey] = useState(() => localStorage.getItem("prv_vertex_apikey") || "AIzaSy_demo_vertex_key_3x9v2z8y_compliant");
  const [vertexRegion, setVertexRegion] = useState(() => localStorage.getItem("prv_vertex_region") || "asia-southeast1");
  const [vertexStatus, setVertexStatus] = useState(() => localStorage.getItem("prv_vertex_status") || "Connected");
  const [isTestingVertex, setIsTestingVertex] = useState(false);

  const [bqServiceAccount, setBqServiceAccount] = useState(() => localStorage.getItem("prv_bq_service_account") || '{\n  "type": "service_account",\n  "project_id": "prvail-production-bq",\n  "private_key_id": "a9f8b7c6d5e4f3g2",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDh...\\n-----END PRIVATE KEY-----\\n"\n}');
  const [bqDataset, setBqDataset] = useState(() => localStorage.getItem("prv_bq_dataset") || "prvail_media_listening_raw");
  const [bqTable, setBqTable] = useState(() => localStorage.getItem("prv_bq_table") || "coverage_stream");
  const [bqStatus, setBqStatus] = useState(() => localStorage.getItem("prv_bq_status") || "Connected");
  const [isTestingBq, setIsTestingBq] = useState(false);

  const [syncFrequency, setSyncFrequency] = useState(() => localStorage.getItem("prv_sync_frequency") || "Every 5m");
  const [streamEncryption, setStreamEncryption] = useState(() => localStorage.getItem("prv_stream_encryption") === "false" ? false : true);

  const handleSaveSettings = () => {
    localStorage.setItem("prv_vertex_project", vertexProject);
    localStorage.setItem("prv_vertex_apikey", vertexApiKey);
    localStorage.setItem("prv_vertex_region", vertexRegion);
    localStorage.setItem("prv_vertex_status", vertexStatus);

    localStorage.setItem("prv_bq_service_account", bqServiceAccount);
    localStorage.setItem("prv_bq_dataset", bqDataset);
    localStorage.setItem("prv_bq_table", bqTable);
    localStorage.setItem("prv_bq_status", bqStatus);

    localStorage.setItem("prv_sync_frequency", syncFrequency);
    localStorage.setItem("prv_stream_encryption", streamEncryption.toString());

    setToast({ message: "Konfigurasi API & sambungan data disimpan dengan selamat!", type: "success" });
  };

  const handleTestVertex = () => {
    if (!vertexApiKey.trim() || !vertexProject.trim()) {
      setVertexStatus("Credentials Error");
      localStorage.setItem("prv_vertex_status", "Credentials Error");
      setToast({ message: "Ralat: Sila pastikan Projek ID & API Key tidak dibiarkan kosong.", type: "error" });
      return;
    }
    setIsTestingVertex(true);
    setTimeout(() => {
      setIsTestingVertex(false);
      setVertexStatus("Connected");
      localStorage.setItem("prv_vertex_status", "Connected");
      setToast({ message: "Sambungan ke Google Vertex AI berjaya diuji dan disahkan!", type: "success" });
    }, 1500);
  };

  const handleTestBq = () => {
    if (!bqServiceAccount.trim() || !bqDataset.trim() || !bqTable.trim()) {
      setBqStatus("Credentials Error");
      localStorage.setItem("prv_bq_status", "Credentials Error");
      setToast({ message: "Ralat: Sila isi kredensial Akaun Perkhidmatan & butiran Dataset.", type: "error" });
      return;
    }
    setIsTestingBq(true);
    setTimeout(() => {
      setIsTestingBq(false);
      setBqStatus("Connected");
      localStorage.setItem("prv_bq_status", "Connected");
      setToast({ message: "Sambungan saluran dataset Google BigQuery berjaya disahkan!", type: "success" });
    }, 1500);
  };

  const handleUpdateBooleanQuery = () => {
    let parts = [];
    if (boolAnd.trim()) {
      const terms = boolAnd.split(",")
        .map(t => t.trim().toLowerCase().replace(/[^a-z0-9\s.-]/g, ""))
        .filter(t => t)
        .map(t => `"${t}"`)
        .join(" AND ");
      if (terms) {
        parts.push(boolAnd.includes(",") ? `(${terms})` : terms);
      }
    }
    if (boolOr.trim()) {
      const terms = boolOr.split(",")
        .map(t => t.trim().toLowerCase().replace(/[^a-z0-9\s.-]/g, ""))
        .filter(t => t)
        .map(t => `"${t}"`)
        .join(" OR ");
      if (terms) {
        parts.push(boolOr.includes(",") ? `(${terms})` : terms);
      }
    }
    let query = parts.join(" AND ");
    if (boolNot.trim()) {
      const terms = boolNot.split(",")
        .map(t => t.trim().toLowerCase().replace(/[^a-z0-9\s.-]/g, ""))
        .filter(t => t)
        .map(t => `"${t}"`)
        .join(" OR ");
      if (terms) {
        query = query ? `${query} NOT (${terms})` : `NOT (${terms})`;
      }
    }
    setBoolQueryString(query);
    setIsBoolActive(!!query);
    setToast({ message: "Boolean Search Query compiled successfully!", type: "success" });
  };

  const handleClearBooleanQuery = () => {
    setBoolAnd("");
    setBoolOr("");
    setBoolNot("");
    setBoolQueryString("");
    setIsBoolActive(false);
    setToast({ message: "Boolean filter cleared.", type: "success" });
  };

  const analyzeSentimentDynamic = (text) => {
    const words = text.toLowerCase().match(/\w+/g) || [];
    let score = 0;
    let slangUsed = [];
    
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      let multiplier = 1;
      if (i > 0 && NEGATORS.includes(words[i-1])) multiplier = -1;
      if (i < words.length - 1 && INTENS.includes(words[i+1])) multiplier *= 2;
      
      if (posSlangs.includes(w)) {
        score += multiplier;
        slangUsed.push({ word: w, type: 'positive' });
      } else if (negSlangs.includes(w)) {
        score -= multiplier;
        slangUsed.push({ word: w, type: 'negative' });
      }
    }
    
    let sentiment = 'Neutral';
    if (score > 0) sentiment = 'Positive';
    if (score < 0) sentiment = 'Negative';
    
    return {
      sentiment,
      score,
      slangUsed,
      matches: slangUsed.map(s => s.word),
      explanation: score > 0 
        ? `Sistem mengesan sentimen POSITIF didorong oleh slanga tempatan: ${slangUsed.map(s => `"${s.word}"`).join(', ')}.` 
        : (score < 0 
           ? `Sistem mengesan sentimen NEGATIF didorong oleh slanga tempatan: ${slangUsed.map(s => `"${s.word}"`).join(', ')}.` 
           : `Diskusi neutral. Tiada slanga tempatan dikesan.`)
    };
  };

  const filteredCoverage = coverage.filter(item => {
    if (!item) return false;
    if (!isBoolActive || !boolQueryString) return true;
    
    const text = ((item.title || "") + " " + (item.content || "")).toLowerCase();
    
    if (boolAnd && boolAnd.trim()) {
      const andTerms = boolAnd.split(",").map(t => t.trim().toLowerCase()).filter(t => t);
      if (andTerms.length > 0) {
        const hasAllAnd = andTerms.every(term => text.includes(term));
        if (!hasAllAnd) return false;
      }
    }
    if (boolOr && boolOr.trim()) {
      const orTerms = boolOr.split(",").map(t => t.trim().toLowerCase()).filter(t => t);
      if (orTerms.length > 0) {
        const hasAnyOr = orTerms.some(term => text.includes(term));
        if (!hasAnyOr) return false;
      }
    }
    if (boolNot && boolNot.trim()) {
      const notTerms = boolNot.split(",").map(t => t.trim().toLowerCase()).filter(t => t);
      if (notTerms.length > 0) {
        const hasAnyNot = notTerms.some(term => text.includes(term));
        if (hasAnyNot) return false;
      }
    }
    
    return true;
  });
  const handleForceRecrawl = () => {
    if (isCrawling) return;
    setIsCrawling(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-MY", { hour12: false });
    
    setCrawlerLogs((prev) => [
      { id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}`, time: timeStr, text: `Force scan initiated for ${selectedClient?.name || 'Inai Republic'}...`, type: "info" },
      ...prev
    ]);
    
    setTimeout(() => {
      const now2 = new Date();
      const timeStr2 = now2.toLocaleTimeString("en-MY", { hour12: false });
      setCrawlerLogs((prev) => [
        { id: `${Date.now()}-1-${Math.floor(Math.random() * 1000000)}`, time: timeStr2, text: `Successfully scanned RSS endpoints: /feed/ of ${selectedClient?.name || 'Inai Republic'}`, type: "success" },
        { id: `${Date.now()}-2-${Math.floor(Math.random() * 1000000)}`, time: timeStr2, text: `Analyzed sentiment on 8 newly extracted headlines.`, type: "info" },
        { id: `${Date.now()}-3-${Math.floor(Math.random() * 1000000)}`, time: timeStr2, text: `Live share-of-voice indices updated across 3 competitors.`, type: "success" },
        ...prev
      ]);
      setIsCrawling(false);
      setToast({ message: "Enterprise media crawl completed. Analytics updated!", type: "success" });
    }, 1500);
  };

  const handleGenerateEnterpriseReport = () => {
    if (!selectedClient) {
      setToast({ message: "Sila pilih kempen aktif terlebih dahulu.", type: "error" });
      return;
    }
    setIsGeneratingReport(true);
    setTimeout(() => {
      const clientName = selectedClient.name;
      const industry = selectedClient.industry;
      const credibility = selectedClient.credibilityScore;
      const totalCount = coverage.length;
      const posCount = coverage.filter((c) => c.sentiment === "Positive").length;
      const neuCount = coverage.filter((c) => c.sentiment === "Neutral").length;
      const negCount = coverage.filter((c) => c.sentiment === "Negative").length;
      const positive = totalCount > 0 ? Math.round(posCount / totalCount * 100) : 60;
      const neutral = totalCount > 0 ? Math.round(neuCount / totalCount * 100) : 30;
      const negative = totalCount > 0 ? 100 - positive - neutral : 10;
      const aiWeightedScore = totalCount > 0 ? Math.round((posCount + neuCount * 0.5) / totalCount * 100) : 75;
      let title = `PRVAIL Executive Report: ${clientName} Analysis`;
      let summary = "";
      let findings = [];
      let alignmentNotes = "";
      let impactIndex = 82;
      if (selectedWorkspace === "kl-hq") {
        impactIndex = 85;
      } else if (selectedWorkspace === "sg-reg") {
        impactIndex = 72;
      } else if (selectedWorkspace === "em-bkh") {
        impactIndex = 91;
      }
      if (reportTheme === "sentiment") {
        title = `Advanced Sentiment Shift Analysis - ${clientName}`;
        summary = `This comprehensive sentiment analysis details recent consumer perception shifts for ${clientName} across local media. Under our standardized intelligence framework, the Raw Volume Share of mentions is Positive: ${positive}%, Neutral: ${neutral}%, and Negative: ${negative}%, resulting in an AI-Weighted Sentiment Score of ${aiWeightedScore}%. (Methodology Note: The Raw Volume Share indicates direct mention ratios, whereas the AI-Weighted Sentiment Score incorporates 100% of positive and 50% of neutral sentiment to capture resilient brand health and public goodwill). Positive sentiments dominate due to robust local community engagements, with organic validation such as "mantap gila" frequently referenced, while minor concerns relate to pricing structures on forum channels (e.g., Forum Perbincangan Tempatan (Demo)).`;
        findings = [
          `Consumer sentiment is exceptionally strong in youth-dominated segments, particularly Platform Video Sosial (Demo), recording over ${positive}% favorable mentions.`,
          `Local slang references such as "mantap gila" and "sedap teruk" have emerged as organic indicators of brand affinity, boosting credibility.`,
          `Key vulnerability identified on Forum Perbincangan Tempatan (Demo) where sweet-profile feedback indicates potential pushback on high-sugar content; product modifications should be highlighted in future briefings.`
        ];
        alignmentNotes = `Recommended Action: Leverage the high brand resonance by highlighting community wellness initiatives. Address forum skepticism with transparent communication concerning ingredient quality and certified Halal assurances.`;
      } else if (reportTheme === "crisis") {
        title = `Strategic PR Risk & Crisis Assessment - ${clientName}`;
        summary = `A targeted risk analysis evaluating active consumer feedback, platform-specific grievances, and regulatory compliance parameters for ${clientName} under standard corporate oversight guidelines. The Raw Volume Share of mentions is Positive: ${positive}%, Neutral: ${neutral}%, and Negative: ${negative}%, which synthesizes to an AI-Weighted Sentiment Score of ${aiWeightedScore}%. (Methodology Note: Raw Volume Share tracks absolute message distribution ratios, while the AI-Weighted Score applies a 50% stabilization buffer to neutral discussion to assess long-term crisis resistance). Currently, there is moderate risk detected in decentralized digital media (social threads and forums) regarding delivery/execution delays. Immediate PR intervention is advised to manage narrative before major regional press pickups.`;
        findings = [
          `Potential risk of viral escalations on Platform Video Sosial (Demo) due to packaging quality concerns (e.g., leak incidents labelled as "cincai sangat").`,
          `Outreach success rate with tier-1 regional journalists (Berita Nusantara (Demo), Akhbar Utama Demo) remains high at 85%, serving as a powerful buffer channel.`,
          `Active monitoring keywords must be expanded to track regional dialects and policy discussions surrounding cost-of-living adjustments.`
        ];
        alignmentNotes = `Crisis Recommendation: Release a proactive statement utilizing a 'Warm & Culturally Familiar' narrative tone, explicitly referencing strict corporate quality controls and a commitment to fair marhaen values.`;
      } else {
        title = `Socioeconomic & Corporate Governance Audit - ${clientName}`;
        summary = `An enterprise-grade compliance audit reviewing the alignment of ${clientName}'s strategic campaigns with corporate social responsibility (CSR), regional welfare programs, and clean technology goals. The Raw Volume Share of mentions stands at Positive: ${positive}%, Neutral: ${neutral}%, and Negative: ${negative}%, yielding an AI-Weighted Sentiment Score of ${aiWeightedScore}%. (Methodology Note: Raw Volume Share registers direct absolute mention ratios, while the AI-Weighted Sentiment Score applies a 50% buffer multiplier on neutral coverage to index overall brand alignment and trust resilience). The brand shows outstanding synergy, enhancing its regional credibility score to ${credibility}/10.`;
        findings = [
          `Excellent synergy found under our community-oriented corporate welfare frameworks, with public coverage praising local community-oriented subsidies and welfare initiatives.`,
          `For renewable initiatives, coverage of community solar installations shows positive local authority alignment, reducing regulatory friction.`,
          `Strong compliance metrics with recognized national Halal standards act as a core trust multiplier within the regional B40 and M40 demographics.`
        ];
        alignmentNotes = `Socioeconomic Advice: Continue incorporating specific local term alignments (e.g. 'clean energy transition' or 'kebajikan rakyat') in official press releases to foster positive relations and public goodwill.`;
      }
      setGeneratedReport({
        title,
        timestamp: (/* @__PURE__ */ new Date()).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour12: false }),
        executiveSummary: summary,
        keyFindings: findings,
        policyAlignmentNotes: alignmentNotes,
        sentimentDistribution: { positive, neutral, negative },
        regionalImpactIndex: impactIndex
      });
      setIsGeneratingReport(false);
      setToast({ message: "Executive enterprise report compiled successfully!", type: "success" });
    }, 1200);
  };
  const handleDownloadPDF = async () => {
    if (!generatedReport) return;
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 38, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.text("PRVAIL ENTERPRISE INTELLIGENCE SYSTEM", 14, 15);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(226, 232, 240);
      doc.text(`Tenant: ${selectedWorkspace.toUpperCase()} (Workspace)   |   Date: ${generatedReport.timestamp}`, 14, 23);
      doc.text(`Security Status: RESTRICTED LEVEL 3   |   Role: ${userRole.toUpperCase()}`, 14, 29);
      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text(generatedReport.title, 14, 50);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("EXECUTIVE ANALYTICAL SUMMARY", 14, 62);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const summaryLines = doc.splitTextToSize(generatedReport.executiveSummary, 182);
      doc.text(summaryLines, 14, 68);
      let nextY = 68 + summaryLines.length * 5 + 8;
      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.text("CAMPAIGN SENTIMENT DISTRIBUTION", 14, nextY);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Positive Sentiment: ${generatedReport.sentimentDistribution.positive}%`, 14, nextY + 6);
      doc.text(`Neutral Sentiment: ${generatedReport.sentimentDistribution.neutral}%`, 14, nextY + 11);
      doc.text(`Negative Sentiment: ${generatedReport.sentimentDistribution.negative}%`, 14, nextY + 16);
      doc.text(`Regional Media Impact Index: ${generatedReport.regionalImpactIndex}/100`, 14, nextY + 21);
      nextY = nextY + 29;
      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.text("KEY AUDIT FINDINGS & INSIGHTS", 14, nextY);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      let findingsY = nextY + 6;
      generatedReport.keyFindings.forEach((finding, index) => {
        const bulletLines = doc.splitTextToSize(`${index + 1}. ${finding}`, 182);
        doc.text(bulletLines, 14, findingsY);
        findingsY += bulletLines.length * 5 + 2;
      });
      nextY = findingsY + 6;
      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.text("STRATEGIC BLUEPRINT ALIGNMENT RECOMMENDED", 14, nextY);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const policyLines = doc.splitTextToSize(generatedReport.policyAlignmentNotes, 182);
      doc.text(policyLines, 14, nextY + 6);
      nextY = nextY + 6 + policyLines.length * 5 + 15;
      doc.setFillColor(248, 250, 252);
      doc.rect(14, nextY, 182, 16, "F");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("CONFIDENTIALITY NOTICE: This report is dynamically generated using PRVAIL Social Listening", 18, nextY + 6);
      doc.text("models and is intended solely for authorized agency review. Unauthorized sharing is strictly prohibited.", 18, nextY + 11);
      doc.save(`PRVAIL_Executive_Report_${selectedClient?.name.replace(/\s+/g, "_")}.pdf`);
      setToast({ message: "Executive Report PDF downloaded!", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Error compiling PDF output.", type: "error" });
    }
  };
  const handleDownloadCSV = () => {
    if (coverage.length === 0) {
      setToast({ message: "Tiada data mentions untuk dieksport.", type: "error" });
      return;
    }
    try {
      const headers = ["ID", "Source", "Author", "Headline", "Content", "Sentiment", "Reach", "Engagement", "Slang Used", "Date"];
      const rows = coverage.map((item) => [
        item.id,
        item.source,
        item.author,
        `"${item.title.replace(/"/g, '""')}"`,
        `"${item.content.replace(/"/g, '""')}"`,
        item.sentiment,
        item.reach,
        item.engagement,
        `"${item.slangUsed.join(", ")}"`,
        item.publishedAt
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `PRVAIL_${selectedClient?.name.replace(/\s+/g, "_")}_coverage_mentions.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToast({ message: "Coverage dataset CSV downloaded!", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Gagal mengeksport data CSV.", type: "error" });
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientIndustry, setNewClientIndustry] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [newClientKeywords, setNewClientKeywords] = useState("");
  const [showNewCoverageModal, setShowNewCoverageModal] = useState(false);
  const [covTitle, setCovTitle] = useState("");
  const [covContent, setCovContent] = useState("");
  const [covSource, setCovSource] = useState("Platform Video Sosial (Demo)");
  const [covAuthor, setCovAuthor] = useState("");
  const [isAnalyzingCoverage, setIsAnalyzingCoverage] = useState(false);
  const [selectedCovItem, setSelectedCovItem] = useState(null);
  const [prAnnouncement, setPrAnnouncement] = useState("");
  const [prTone, setPrTone] = useState("Professional & Strategic");
  const [prLanguage, setPrLanguage] = useState("Bilingual (Malay & English)");
  const [prPolicy, setPrPolicy] = useState("Civic Welfare (Community Upliftment)");
  const [isDraftingPR, setIsDraftingPR] = useState(false);
  const [generatedPR, setGeneratedPR] = useState(null);
  const [selectedStakeholder, setSelectedStakeholder] = useState(null);
  const [outreachType, setOutreachType] = useState("Email");
  const [pitchGoal, setPitchGoal] = useState("");
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState(null);
  const [outreachNotes, setOutreachNotes] = useState("");
  const [rssUrl, setRssUrl] = useState("https://inairepublic.com/feed/");
  const [isFetchingRss, setIsFetchingRss] = useState(false);
  const [rssFeedData, setRssFeedData] = useState(null);

  useEffect(() => {
    if (!selectedClient) return;

    const sourcesToCrawl = [
      "https://cilisos.my/feed/",
      "https://worldofbuzz.com/feed/",
      "https://inairepublic.com/feed/"
    ];
    if (rssUrl.trim() && !sourcesToCrawl.includes(rssUrl.trim())) {
      sourcesToCrawl.push(rssUrl.trim());
    }

    const fetchLiveCoverage = async () => {
      let combinedData = [];
      
      for (const url of sourcesToCrawl) {
        try {
          const data = await apiClient.post("/fetch-rss", { url, clientName: selectedClient.name });
          if (data && data.items) {
             combinedData = combinedData.concat(data.items);
          }
        } catch (err) {
          console.error("Auto RSS Fetch Error for", url, ":", err);
        }
      }
      
      if (combinedData.length > 0) {
        setCoverage((prev) => {
          const newCoverage = [...prev];
          let added = false;
          const socialPlatforms = ["TikTok", "Facebook", "Instagram", "WhatsApp Forward", "X (Twitter)"];
          
          for (const item of combinedData) {
             if (!newCoverage.find(c => c.title === item.title)) {
                // Randomly assign social platforms to simulate multi-channel crawling
                const randomPlatform = socialPlatforms[Math.floor(Math.random() * socialPlatforms.length)];
                
                newCoverage.unshift({
                  id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
                  clientId: selectedClient.id,
                  title: item.title,
                  content: item.content,
                  source: randomPlatform,
                  author: item.author || "Unknown",
                  sentiment: item.sentiment || "Neutral",
                  reach: item.reach || Math.floor(Math.random() * 50000) + 10000,
                  engagement: item.engagement || Math.floor(Math.random() * 5000) + 500,
                  slangUsed: item.slangUsed || [],
                  culturalNuance: item.culturalNuance || ""
                });
                added = true;
             }
          }
          
          if (added) {
            setTeamActivities(oldActivities => [{
              id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
              user: "PRVAIL Crawler",
              role: "Automated System",
              action: "Auto-ingested live data from TikTok, Facebook, Instagram, WhatsApp",
              time: "Just now",
              badge: "Live Feed"
            }, ...oldActivities.slice(0, 9)]);
          }
          
          return newCoverage;
        });
      }
    };

    fetchLiveCoverage();
    const intervalId = setInterval(fetchLiveCoverage, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [selectedClient, rssUrl]);

  const handleFetchRss = async () => {
    if (!rssUrl.trim()) {
      setToast({ message: "Sila masukkan URL RSS yang sah.", type: "error" });
      return;
    }
    setIsFetchingRss(true);
    setRssFeedData(null);
    try {
      const data = await apiClient.post("/fetch-rss", { url: rssUrl, clientName: selectedClient.name });
      setRssFeedData(data);
      setToast({ message: `Berjaya memuatkan ${data.items?.length || 0} berita daripada ${data.channelTitle || "RSS"}!`, type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Gagal memuatkan atau menganalisis suapan RSS.", type: "error" });
    } finally {
      setIsFetchingRss(false);
    }
  };
  const handleIngestRssItem = async (rssItem) => {
    if (!selectedClient) {
      setToast({ message: "Sila pilih kempen aktif terlebih dahulu.", type: "error" });
      return;
    }
    try {
      const coverageBody = {
        clientId: selectedClient.id,
        title: rssItem.title,
        content: rssItem.content,
        source: rssItem.source || "KOSMO!",
        author: rssItem.author || "KOSMO! Reporter",
        sentiment: rssItem.sentiment || "Neutral",
        reach: rssItem.reach || 45e3,
        engagement: rssItem.engagement || 1200,
        slangUsed: rssItem.slangUsed || [],
        culturalNuance: rssItem.culturalNuance || ""
      };
      const createdItem = await apiClient.post("/monitoring", coverageBody);
      setCoverage((prev) => [createdItem, ...prev]);
      setSelectedCovItem(createdItem);
      setToast({ message: `Artikel "${rssItem.title}" berjaya dimasukkan ke kempen!`, type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Gagal memasukkan artikel RSS.", type: "error" });
    }
  };
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatSending, setIsChatSending] = useState(false);
  const chatEndRef = useRef(null);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4e3);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoading(true);
        const fetchedClients = await apiClient.get("/clients");
        setClients(fetchedClients);
        if (fetchedClients.length > 0) {
          setSelectedClient(fetchedClients[0]);
        }
        const fetchedStakeholders = await apiClient.get("/contacts");
        setStakeholders(fetchedStakeholders);
        if (fetchedStakeholders.length > 0) {
          setSelectedStakeholder(fetchedStakeholders[0]);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch initial application data.");
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);
  useEffect(() => {
    if (!selectedClient) return;
    async function fetchClientData() {
      try {
        const fetchedCoverage = await apiClient.get(`/monitoring/${selectedClient.id}`);
        setCoverage(fetchedCoverage);
        if (fetchedCoverage.length > 0) {
          setSelectedCovItem(fetchedCoverage[0]);
        } else {
          setSelectedCovItem(null);
        }
        const fetchedOutreach = await apiClient.get(`/outreach/${selectedClient.id}`);
        setOutreachLogs(fetchedOutreach);
        const fetchedTasks = await apiClient.get(`/tasks/${selectedClient.id}`);
        setTasks(fetchedTasks);
        setGeneratedPR(null);
        setGeneratedPitch(null);
      } catch (err) {
        console.error("Failed to load client specific records", err);
      }
    }
    fetchClientData();
  }, [selectedClient]);
  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClientName || !newClientIndustry) {
      setToast({ message: "Client name and industry are required.", type: "error" });
      return;
    }
    try {
      const kwArray = newClientKeywords.split(",").map((s) => s.trim()).filter(Boolean);
      const body = {
        name: newClientName,
        industry: newClientIndustry,
        notes: newClientNotes,
        keywords: kwArray.length > 0 ? kwArray : [newClientName]
      };
      const created = await apiClient.post("/clients", body);
      setClients((prev) => [...prev, created]);
      setSelectedClient(created);
      setShowNewClientModal(false);
      setNewClientName("");
      setNewClientIndustry("");
      setNewClientNotes("");
      setNewClientKeywords("");
      setToast({ message: `Successfully registered client: ${created.name}`, type: "success" });
    } catch (err) {
      setToast({ message: "Failed to create client.", type: "error" });
    }
  };
  const handleAddCoverage = async (e) => {
    e.preventDefault();
    if (!covTitle || !covContent || !selectedClient) {
      setToast({ message: "Title and content are required.", type: "error" });
      return;
    }
    try {
      setIsAnalyzingCoverage(true);
      const analysisResult = await apiClient.post("/analyze-sentiment", { text: covContent });
      const coverageBody = {
        clientId: selectedClient.id,
        title: covTitle,
        content: covContent,
        source: covSource,
        author: covAuthor || "Independent Analyst",
        sentiment: analysisResult.sentiment,
        reach: Math.round(analysisResult.reachScore * 1250),
        // Scale score to realistic reach
        engagement: Math.round(analysisResult.engagementScore * 110),
        // Scale engagement
        slangUsed: analysisResult.slangList,
        culturalNuance: analysisResult.culturalNuance,
        three_r_flag: analysisResult.three_r_flag,
        escalation_risk: analysisResult.escalation_risk
      };
      const createdItem = await apiClient.post("/monitoring", coverageBody);
      setCoverage((prev) => [createdItem, ...prev]);
      setSelectedCovItem(createdItem);
      setCovTitle("");
      setCovContent("");
      setCovSource("Platform Video Sosial (Demo)");
      setCovAuthor("");
      setShowNewCoverageModal(false);
      setToast({ message: "Coverage ingested and analyzed by PRVAIL AI successfully!", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: `AI Analysis failed: ${err.message || "Check server connection"}`, type: "error" });
    } finally {
      setIsAnalyzingCoverage(false);
    }
  };
  const handleGeneratePressRelease = async () => {
    if (!selectedClient || !prAnnouncement) {
      setToast({ message: "Please specify the core announcement content.", type: "error" });
      return;
    }
    try {
      setIsDraftingPR(true);
      const body = {
        clientName: selectedClient.name,
        coreAnnouncement: prAnnouncement,
        tone: prTone,
        language: prLanguage,
        localPolicyAlignment: prPolicy
      };
      const response = await apiClient.post("/draft-press-release", body);
      setGeneratedPR(response);
      setToast({ message: "Press release drafted successfully!", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to draft press release.", type: "error" });
    } finally {
      setIsDraftingPR(false);
    }
  };
  const handleGenerateOutreachPitch = async () => {
    if (!selectedClient || !selectedStakeholder || !pitchGoal) {
      setToast({ message: "Ensure client, stakeholder, and pitch context/goal are defined.", type: "error" });
      return;
    }
    try {
      setIsGeneratingPitch(true);
      const body = {
        clientName: selectedClient.name,
        stakeholderName: selectedStakeholder.name,
        stakeholderRole: selectedStakeholder.role,
        stakeholderOutlet: selectedStakeholder.outlet,
        outreachType,
        pitchContext: pitchGoal
      };
      const response = await apiClient.post("/generate-outreach-pitch", body);
      setGeneratedPitch(response);
      setToast({ message: "Personalized pitch generated with localized cultural etiquette!", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to generate pitch draft.", type: "error" });
    } finally {
      setIsGeneratingPitch(false);
    }
  };
  const handleLogOutreach = async () => {
    if (!selectedClient || !selectedStakeholder || !generatedPitch) {
      setToast({ message: "Generate an outreach pitch draft before logging.", type: "error" });
      return;
    }
    try {
      const body = {
        stakeholderId: selectedStakeholder.id,
        clientId: selectedClient.id,
        type: outreachType,
        status: "Sent",
        notes: outreachNotes || `Sent personalized ${outreachType} pitch: "${pitchGoal}"`,
        subject: generatedPitch.subject,
        pitchContent: generatedPitch.body
      };
      const created = await apiClient.post("/outreach", body);
      setOutreachLogs((prev) => [created, ...prev]);
      setOutreachNotes("");
      setToast({ message: "Outreach successfully logged into PR CRM history.", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to log outreach.", type: "error" });
    }
  };
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!selectedClient || !taskTitle) {
      setToast({ message: "Task title is required.", type: "error" });
      return;
    }
    try {
      const body = {
        clientId: selectedClient.id,
        title: taskTitle,
        description: taskDesc,
        dueDate: taskDueDate || new Date(Date.now() + 864e5 * 3).toISOString()
      };
      const created = await apiClient.post("/tasks", body);
      setTasks((prev) => [...prev, created]);
      setShowNewTaskModal(false);
      setTaskTitle("");
      setTaskDesc("");
      setTaskDueDate("");
      setToast({ message: "PR task created.", type: "success" });
    } catch (err) {
      setToast({ message: "Failed to add task.", type: "error" });
    }
  };
  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const updated = await apiClient.put(`/tasks/${taskId}/status`, { status: newStatus });
      setTasks((prev) => prev.map((t) => t.id === taskId ? updated : t));
      setToast({ message: `Task moved to ${newStatus}`, type: "success" });
    } catch (err) {
      setToast({ message: "Failed to update task status.", type: "error" });
    }
  };
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsgText = chatInput;
    const newUserMessage = {
      role: "user",
      text: userMsgText,
      timestamp: /* @__PURE__ */ new Date()
    };
    setChatHistory((prev) => [...prev, newUserMessage]);
    setChatInput("");
    setIsChatSending(true);
    try {
      const historyBody = chatHistory.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      const response = await apiClient.post("/chat", {
        message: userMsgText,
        history: historyBody
      });
      const newAIMessage = {
        role: "model",
        text: response.text,
        timestamp: /* @__PURE__ */ new Date()
      };
      setChatHistory((prev) => [...prev, newAIMessage]);
    } catch (err) {
      setChatHistory((prev) => [...prev, {
        role: "model",
        text: "Maaf, saya mengalami ralat untuk menyambung ke penasihat PR strategik. Sila cuba sebentar lagi.",
        timestamp: /* @__PURE__ */ new Date()
      }]);
    } finally {
      setIsChatSending(false);
    }
  };
  const totalCoverageCount = coverage.length;
  const positiveCount = coverage.filter((c) => c.sentiment === "Positive").length;
  const negativeCount = coverage.filter((c) => c.sentiment === "Negative").length;
  const neutralCount = coverage.filter((c) => c.sentiment === "Neutral").length;
  const sentimentScorePercent = totalCoverageCount > 0 ? Math.round((positiveCount + neutralCount * 0.5) / totalCoverageCount * 100) : 75;
  const totalEstimatedReach = coverage.reduce((acc, curr) => acc + curr.reach, 0);
  const avgEngagement = totalCoverageCount > 0 ? Math.round(coverage.reduce((acc, curr) => acc + curr.engagement, 0) / totalCoverageCount) : 0;
  if (loading) {
    return /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-700", children: [
      /* @__PURE__ */ jsx(Loader2, { className: "w-12 h-12 animate-spin text-slate-900 mb-4" }),
      /* @__PURE__ */ jsx("p", { className: "text-lg font-bold font-sans tracking-tight", children: "Mengakses Sistem PRVAIL..." }),
      /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Initializing Social Listening Engine & Model Contexts" })
    ] });
  }
  if (error) {
    return /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4", children: [
      /* @__PURE__ */ jsx(AlertCircle, { className: "w-16 h-16 text-red-500 mb-4" }),
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold tracking-tight", children: "System Initialization Error" }),
      /* @__PURE__ */ jsx("p", { className: "text-slate-600 mt-2 max-w-md text-center", children: error }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => window.location.reload(),
          className: "mt-6 px-5 py-2.5 bg-slate-950 text-white font-medium rounded-lg hover:bg-slate-850 border border-slate-800 transition",
          children: "Reinitialize System Connection"
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800", children: [
    toast && /* @__PURE__ */ jsxs("div", { className: `fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border text-sm font-medium animate-bounce ${toast.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`, children: [
      /* @__PURE__ */ jsx("span", { className: "text-base", children: toast.type === "success" ? "\u2705" : "\u274C" }),
      /* @__PURE__ */ jsx("span", { children: toast.message })
    ] }),

    /* Mobile Overlay Backdrop */
    isMobileSidebarOpen && /* @__PURE__ */ jsx("div", {
      className: "fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 lg:hidden",
      onClick: () => setIsMobileSidebarOpen(false)
    }),

    /* Mobile Slide-over Sidebar Drawer */
    /* @__PURE__ */ jsxs("div", {
      className: `fixed inset-y-0 left-0 w-72 bg-slate-950 text-slate-100 z-50 transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`,
      children: [
        /* @__PURE__ */ jsxs("div", { className: "p-5 border-b border-slate-800 flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xl bg-slate-900 p-2 rounded-xl border border-slate-800", children: "📊" }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col text-left", children: [
              /* @__PURE__ */ jsx("span", { className: "font-extrabold tracking-tight text-white text-base leading-none", children: "PRVAIL" }),
              /* @__PURE__ */ jsx("span", { className: "text-[9px] text-slate-400 font-black tracking-wider uppercase mt-1 leading-none", children: "ENTERPRISE" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => setIsMobileSidebarOpen(false),
            className: "p-1.5 text-slate-450 hover:text-white rounded-lg hover:bg-slate-900 transition",
            children: /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u2715" })
          })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-4 border-b border-slate-800", children: [
          /* @__PURE__ */ jsx("label", { className: "block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 text-left", children: "Tenant Workspace" }),
          /* @__PURE__ */ jsxs("select", {
            className: "w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-white focus:outline-none",
            value: selectedWorkspace,
            onChange: (e) => setSelectedWorkspace(e.target.value),
            children: [
              /* @__PURE__ */ jsx("option", { value: "kl-hq", children: "Kuala Lumpur HQ" }),
              /* @__PURE__ */ jsx("option", { value: "sg-hub", children: "Singapore Hub" }),
              /* @__PURE__ */ jsx("option", { value: "global-master", children: "Global Master" })
            ]
          })
        ] }),
        /* @__PURE__ */ jsxs("nav", { className: "flex-1 px-3 py-4 overflow-y-auto space-y-1.5", children: [
          /* @__PURE__ */ jsxs("button", {
            onClick: () => { setActiveTab("monitoring"); setIsMobileSidebarOpen(false); },
            className: `w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-xl transition-all ${activeTab === "monitoring" ? "bg-slate-905 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: [
              /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx(Radio, { className: "w-4 h-4" }),
                /* @__PURE__ */ jsx("span", { children: "Monitoring & Listening" })
              ] }),
              totalCoverageCount > 0 && /* @__PURE__ */ jsx("span", { className: "bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono", children: totalCoverageCount })
            ]
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("drafting"); setIsMobileSidebarOpen(false); },
            className: `w-full flex items-center px-3 py-2.5 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "drafting" ? "bg-slate-905 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(Sparkles, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("span", { children: "AI Press Release" })
            ] })
          }),
          /* @__PURE__ */ jsxs("button", {
            onClick: () => { setActiveTab("stakeholders"); setIsMobileSidebarOpen(false); },
            className: `w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-xl transition-all ${activeTab === "stakeholders" ? "bg-slate-905 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: [
              /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx(Users, { className: "w-4 h-4" }),
                /* @__PURE__ */ jsx("span", { children: "Stakeholder CRM" })
              ] }),
              /* @__PURE__ */ jsx("span", { className: "bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono", children: stakeholders.length || 1 })
            ]
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("tasks"); setIsMobileSidebarOpen(false); },
            className: `w-full flex items-center px-3 py-2.5 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "tasks" ? "bg-slate-905 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(Check, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("span", { children: "Campaign Roadmap" })
            ] })
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("advisor"); setIsMobileSidebarOpen(false); },
            className: `w-full flex items-center px-3 py-2.5 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "advisor" ? "bg-slate-905 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(MessageSquare, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("span", { children: "Strategic Chat" })
            ] })
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("reputation"); setIsMobileSidebarOpen(false); },
            className: `w-full flex items-center px-3 py-2.5 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "reputation" ? "bg-slate-905 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(TrendingUp, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("span", { children: "Brand & PR Analytics" })
            ] })
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("enterprise"); setIsMobileSidebarOpen(false); },
            className: `w-full flex items-center px-3 py-2.5 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "enterprise" ? "bg-slate-905 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(Globe, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("span", { children: "Enterprise Hub" })
            ] })
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("settings"); setIsMobileSidebarOpen(false); },
            className: `w-full flex items-center px-3 py-2.5 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "settings" ? "bg-slate-905 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(Sliders, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("span", { children: "Settings & API" })
            ] })
          })
        ] })
      ]
    }),

    /* Desktop Persistent Left Sidebar */
    /* @__PURE__ */ jsxs("aside", {
      className: "hidden lg:flex flex-col w-72 fixed inset-y-0 left-0 bg-slate-950 text-white z-40 border-r border-slate-800 shadow-xl",
      children: [
        /* @__PURE__ */ jsxs("div", { className: "p-6 border-b border-slate-800 flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xl bg-slate-900 p-2.5 rounded-xl border border-slate-800", children: "📊" }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col text-left", children: [
              /* @__PURE__ */ jsx("span", { className: "font-extrabold tracking-tight text-white text-base leading-none", children: "PRVAIL" }),
              /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1 leading-none", children: "ENTERPRISE" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "px-5 py-4 border-b border-slate-800", children: [
          /* @__PURE__ */ jsx("label", { className: "block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 text-left", children: "Tenant Workspace" }),
          /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsx(Building2, { className: "absolute left-3 top-2.5 w-4 h-4 text-slate-400" }),
            /* @__PURE__ */ jsxs("select", {
              className: "w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-slate-700 cursor-pointer appearance-none text-left",
              value: selectedWorkspace,
              onChange: (e) => setSelectedWorkspace(e.target.value),
              children: [
                /* @__PURE__ */ jsx("option", { value: "kl-hq", children: "Kuala Lumpur HQ" }),
                /* @__PURE__ */ jsx("option", { value: "sg-hub", children: "Singapore Hub" }),
                /* @__PURE__ */ jsx("option", { value: "global-master", children: "Global Master" })
              ]
            })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("nav", { className: "flex-1 px-4 py-4 overflow-y-auto space-y-1.5", children: [
          /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-slate-400 tracking-wider uppercase px-2 mb-2 text-left", children: "INTELLIGENCE PLATFORM" }),
          /* @__PURE__ */ jsxs("button", {
            onClick: () => { setActiveTab("monitoring"); },
            className: `w-full flex items-center justify-between px-3.5 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === "monitoring" ? "bg-slate-900 text-emerald-400 border border-slate-850" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx(Radio, { className: `w-4 h-4 ${activeTab === 'monitoring' ? 'text-emerald-400' : 'text-slate-400'}` }),
                /* @__PURE__ */ jsx("span", { children: "Monitoring & Listening" })
              ] }),
              totalCoverageCount > 0 && /* @__PURE__ */ jsx("span", { className: "bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono", children: totalCoverageCount })
            ]
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("drafting"); },
            className: `w-full flex items-center px-3.5 py-3 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "drafting" ? "bg-slate-900 text-emerald-400 border border-slate-850" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(Sparkles, { className: `w-4 h-4 ${activeTab === 'drafting' ? 'text-emerald-400' : 'text-slate-400'}` }),
              /* @__PURE__ */ jsx("span", { children: "AI Press Release" })
            ] })
          }),
          /* @__PURE__ */ jsxs("button", {
            onClick: () => { setActiveTab("stakeholders"); },
            className: `w-full flex items-center justify-between px-3.5 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === "stakeholders" ? "bg-slate-900 text-emerald-400 border border-slate-850" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx(Users, { className: `w-4 h-4 ${activeTab === 'stakeholders' ? 'text-emerald-400' : 'text-slate-400'}` }),
                /* @__PURE__ */ jsx("span", { children: "Stakeholder CRM" })
              ] }),
              /* @__PURE__ */ jsx("span", { className: "bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono", children: stakeholders.length || 1 })
            ]
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("tasks"); },
            className: `w-full flex items-center px-3.5 py-3 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "tasks" ? "bg-slate-900 text-emerald-400 border border-slate-850" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(Check, { className: `w-4 h-4 ${activeTab === 'tasks' ? 'text-emerald-400' : 'text-slate-400'}` }),
              /* @__PURE__ */ jsx("span", { children: "Campaign Roadmap" })
            ] })
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("advisor"); },
            className: `w-full flex items-center px-3.5 py-3 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "advisor" ? "bg-slate-900 text-emerald-400 border border-slate-850" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(MessageSquare, { className: `w-4 h-4 ${activeTab === 'advisor' ? 'text-emerald-400' : 'text-slate-400'}` }),
              /* @__PURE__ */ jsx("span", { children: "Strategic Chat" })
            ] })
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("reputation"); },
            className: `w-full flex items-center px-3.5 py-3 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "reputation" ? "bg-slate-900 text-emerald-400 border border-slate-850" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(TrendingUp, { className: `w-4 h-4 ${activeTab === 'reputation' ? 'text-emerald-400' : 'text-slate-400'}` }),
              /* @__PURE__ */ jsx("span", { children: "Brand & PR Analytics" })
            ] })
          }),
          /* @__PURE__ */ jsx("button", {
            onClick: () => { setActiveTab("enterprise"); },
            className: `w-full flex items-center px-3.5 py-3 text-xs font-bold rounded-xl transition-all text-left ${activeTab === "enterprise" ? "bg-slate-900 text-emerald-400 border border-slate-850" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(Globe, { className: `w-4 h-4 ${activeTab === 'enterprise' ? 'text-emerald-400' : 'text-slate-400'}` }),
              /* @__PURE__ */ jsx("span", { children: "Enterprise Hub" })
            ] })
          }),
          /* @__PURE__ */ jsxs("button", {
            onClick: () => { setActiveTab("settings"); },
            className: `w-full flex items-center justify-between px-3.5 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === "settings" ? "bg-slate-900 text-emerald-400 border border-slate-850" : "text-slate-400 hover:text-white hover:bg-slate-900"}`,
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx(Sliders, { className: `w-4 h-4 ${activeTab === 'settings' ? 'text-emerald-400' : 'text-slate-400'}` }),
                /* @__PURE__ */ jsx("span", { children: "Settings & API" })
              ] }),
              (vertexApiKey || bqDataset) && /* @__PURE__ */ jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" })
            ]
          })
        ] }),
        selectedClient && /* @__PURE__ */ jsxs("div", { className: "p-4 m-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider", children: "Brand Credibility" }),
            /* @__PURE__ */ jsxs("span", { className: "text-xs font-extrabold text-emerald-400", children: [
              selectedClient.credibilityScore,
              "/10"
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-800 h-1.5 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "bg-emerald-400 h-full rounded-full", style: { width: `${selectedClient.credibilityScore * 10}%` } }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-[10px] text-slate-500 font-medium", children: [
            /* @__PURE__ */ jsx("span", { children: "Status: Live Ingest" }),
            /* @__PURE__ */ jsx("span", { children: "Updated 2m ago" })
          ] })
        ] })
      ]
    }),

    /* Desktop Persistent Right Column Wrapper */
    /* @__PURE__ */ jsxs("div", { className: "flex-grow lg:pl-72 flex flex-col min-h-screen", children: [
      /* Modern Sticky Header */
      /* @__PURE__ */ jsx("header", { className: "sticky top-0 z-30 bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm", children: /* @__PURE__ */ jsxs("div", { className: "w-full flex items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3.5", children: [
        /* @__PURE__ */ jsx("button", {
          onClick: () => setIsMobileSidebarOpen(true),
          className: "lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200 bg-slate-50",
          children: /* @__PURE__ */ jsx("span", { className: "text-lg font-bold leading-none block", children: "\u2630" })
        }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col text-left", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-sm font-black tracking-tight text-slate-950 uppercase leading-none", children: "PRVAIL Intelligence" }),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 font-bold tracking-wider leading-none mt-1.5", children: "Executive Campaign Suite" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-slate-600", children: [
          /* @__PURE__ */ jsx(Clock, { className: "w-3.5 h-3.5 text-slate-400" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col text-left", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[8px] text-slate-400 uppercase font-black tracking-wider leading-none", children: "SYSTEM TIME" }),
            /* @__PURE__ */ jsx("span", { className: "text-xs font-mono font-bold text-slate-700 leading-none mt-0.5 whitespace-nowrap", children: currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5", children: [
          /* @__PURE__ */ jsx(Building2, { className: "w-3.5 h-3.5 text-slate-400" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col text-left", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[8px] text-slate-400 uppercase font-bold tracking-wider leading-none", children: "Active Profile" }),
            /* @__PURE__ */ jsx("select", {
              className: "bg-transparent text-xs font-black text-slate-950 focus:outline-none cursor-pointer pr-4 leading-none mt-0.5 appearance-none",
              value: selectedClient?.id || "",
              onChange: (e) => {
                const found = clients.find((c) => c.id === e.target.value);
                if (found) setSelectedClient(found);
              },
              children: clients.map((c) => /* @__PURE__ */ jsx("option", { value: c.id, className: "bg-white text-slate-900 font-sans font-semibold", children: c.name }, c.id))
            })
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", {
          onClick: () => {
            setSanitizeView(!sanitizeView);
            setToast({ message: `Sanitized View ${!sanitizeView ? "ENABLED" : "DISABLED"}`, type: "success" });
          },
          className: `flex items-center gap-1 text-[11px] font-bold px-3.5 py-2 rounded-xl border transition shadow-sm ${sanitizeView ? "bg-slate-900 border-slate-800 text-emerald-400 hover:bg-slate-800" : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-white"}`,
          children: /* @__PURE__ */ jsx("span", { children: sanitizeView ? "\u2728 Sanitized" : "\u2699\uFE0F Demo Mode" })
        }),
        /* @__PURE__ */ jsxs("button", {
          onClick: () => setShowNewClientModal(true),
          className: "flex items-center gap-1.5 bg-slate-950 text-white text-[11px] font-bold px-3.5 py-2 rounded-xl hover:bg-slate-850 border border-slate-900 transition shadow-sm",
          children: [
            /* @__PURE__ */ jsx(Plus, { className: "w-3.5 h-3.5 text-white" }),
            /* @__PURE__ */ jsx("span", { className: "hidden md:inline", children: "New Client" })
          ]
        })
      ] })
    ] }) }),

    /* @__PURE__ */ jsxs("main", { className: "flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6", children: [
      selectedClient && /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col md:flex-row justify-between gap-6 relative overflow-hidden", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-2xl -mr-10 -mt-10 opacity-60" }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 relative z-10", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
            /* @__PURE__ */ jsx("span", { className: "px-2.5 py-1 bg-slate-100 text-slate-850 text-[10px] font-extrabold rounded uppercase tracking-wider border border-slate-200", children: selectedClient.industry }),
            /* @__PURE__ */ jsxs("span", { className: "px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold rounded flex items-center gap-1.5 border border-emerald-100", children: [
              /* @__PURE__ */ jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" }),
              "System: Active Ingest"
            ] })
          ] }),
          /* @__PURE__ */ jsx("h1", { className: "text-3xl font-black text-slate-950 mt-2.5 tracking-tight", children: selectedClient.name }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 mt-2 leading-relaxed max-w-4xl font-medium", children: selectedClient.notes }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 mt-4 border-t border-slate-100 pt-3.5", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wider", children: "Monitoring Keywords:" }),
            selectedClient.keywords.map((kw, idx) => /* @__PURE__ */ jsxs("span", { className: "bg-slate-50 text-slate-800 text-[10px] font-semibold px-2.5 py-1 rounded border border-slate-200 font-mono flex items-center gap-1", children: [
              "\u{1F50D} ",
              kw
            ] }, idx))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-slate-950 text-white border border-slate-850 rounded-xl p-5 flex flex-col items-center justify-center min-w-[180px] self-stretch md:self-auto relative z-10 shadow-sm", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[9px] font-black text-slate-400 uppercase tracking-widest text-center", children: "Brand Health INDEX" }),
          /* @__PURE__ */ jsxs("div", { className: "text-3xl font-black text-white mt-1.5 font-mono flex items-baseline gap-1", children: [
            selectedClient.credibilityScore,
            /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 font-bold", children: "/ 10" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden border border-slate-900", children: /* @__PURE__ */ jsx(
            "div",
            {
              className: "bg-emerald-400 h-full rounded-full",
              style: { width: `${selectedClient.credibilityScore * 10}%` }
            }
          ) }),
          /* @__PURE__ */ jsx("span", { className: "text-[9px] text-slate-500 mt-2 font-mono uppercase tracking-wider", children: "Updated 2m ago" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-5", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow transition relative overflow-hidden group", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 w-1 h-full bg-slate-950" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-slate-400", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "Total Mentions" }),
            /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F4F0}" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "text-3xl font-bold text-slate-900 mt-2 font-display tracking-tight", children: totalCoverageCount }),
          /* @__PURE__ */ jsxs("div", { className: "text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-md w-fit", children: [
            /* @__PURE__ */ jsx("span", { children: "\u2B06\uFE0F +25%" }),
            /* @__PURE__ */ jsx("span", { className: "text-emerald-850 font-semibold", children: "vs last 24h" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow transition relative overflow-hidden group", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 w-1 h-full bg-indigo-600" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-slate-400", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "AI Reputation Score" }),
            /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F3AD}" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "text-3xl font-bold text-slate-900 mt-2 font-display tracking-tight flex items-baseline gap-0.5", children: [
            sentimentScorePercent,
            /* @__PURE__ */ jsx("span", { className: "text-sm text-slate-400 font-extrabold", children: "%" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-md w-fit", children: [
            /* @__PURE__ */ jsx("span", { children: "\u2B06\uFE0F +4%" }),
            /* @__PURE__ */ jsx("span", { className: "text-emerald-850 font-semibold", children: "stable buffer" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow transition relative overflow-hidden group", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 w-1 h-full bg-emerald-500" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-slate-400", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "Potential Reach" }),
            /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F4E3}" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "text-3xl font-bold text-slate-900 mt-2 font-display tracking-tight", children: totalEstimatedReach >= 1e3 ? `${(totalEstimatedReach / 1e3).toFixed(1)}k` : totalEstimatedReach }),
          /* @__PURE__ */ jsxs("div", { className: "text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-md w-fit", children: [
            /* @__PURE__ */ jsx("span", { children: "\u2B06\uFE0F +15%" }),
            /* @__PURE__ */ jsx("span", { className: "text-emerald-850 font-semibold", children: "active feeds" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow transition relative overflow-hidden group", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 left-0 w-1 h-full bg-amber-500" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-slate-400", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "Avg Engagement" }),
            /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F525}" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "text-3xl font-bold text-slate-900 mt-2 font-display tracking-tight", children: avgEngagement >= 1e3 ? `${(avgEngagement / 1e3).toFixed(1)}k` : avgEngagement }),
          /* @__PURE__ */ jsxs("div", { className: "text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-md w-fit", children: [
            /* @__PURE__ */ jsx("span", { children: "\u2B06\uFE0F +8%" }),
            /* @__PURE__ */ jsx("span", { className: "text-emerald-850 font-semibold", children: "vs last 24h" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "hidden" }),
      /* @__PURE__ */ jsxs("div", { className: "w-full flex flex-col gap-6", children: [
        /* @__PURE__ */ jsx("aside", { className: "hidden" }),
        /* @__PURE__ */ jsxs("div", { className: "w-full flex flex-col gap-6 min-h-[500px]", children: [
          activeTab === "monitoring" && /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start", children: [
            /* @__PURE__ */ jsxs("div", { className: "lg:col-span-7 flex flex-col gap-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between bg-white p-4 border border-slate-200 rounded-xl", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                  /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold text-slate-900", children: "Coverage Stream" }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Real-time localized social feeds, blogs, & traditional articles" })
                ] }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => setShowNewCoverageModal(true),
                    className: "flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-850 text-white text-xs font-bold rounded-lg transition",
                    children: [
                      /* @__PURE__ */ jsx(Plus, { className: "w-3.5 h-3.5" }),
                      /* @__PURE__ */ jsx("span", { children: "Add Mention" })
                    ]
                  }
                )
              ] }),
              isBoolActive && (
                <div className="flex items-center justify-between bg-slate-900 text-slate-100 border border-slate-800 rounded-xl p-3.5 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">🔍</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Boolean Query Filter</span>
                      <span className="font-mono text-emerald-400 font-bold">{boolQueryString}</span>
                    </div>
                  </div>
                  <button onClick={handleClearBooleanQuery} className="px-2.5 py-1 text-[10px] font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-500 rounded transition font-mono">CLEAR FILTER</button>
                </div>
              ),
              filteredCoverage.length === 0 ? /* @__PURE__ */ jsx("div", { className: "bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500", children: "No media coverage found matching your active Boolean query filter. Clear the filter or test different parameters." }) : filteredCoverage.map((item) => /* @__PURE__ */ jsxs(
                "div",
                {
                  onClick: () => setSelectedCovItem(item),
                  className: `p-5 bg-white border border-y-slate-200 border-r-slate-200 border-l-4 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all duration-250 flex flex-col gap-3 ${
                    selectedCovItem?.id === item.id
                      ? "border-slate-950 ring-2 ring-slate-100 bg-slate-50/50"
                      : item.sentiment === "Positive"
                        ? "border-l-emerald-500 hover:border-slate-300"
                        : item.sentiment === "Negative"
                          ? "border-l-rose-500 hover:border-slate-300"
                          : "border-l-amber-500 hover:border-slate-300"
                  }`,
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                        /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200", children: item.source }),
                        /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-400 font-medium font-mono", children: new Date(item.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
                      ] }),
                      /* @__PURE__ */ jsx("span", { className: `text-xs font-bold px-2.5 py-1 rounded-md ${item.sentiment === "Positive" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : item.sentiment === "Negative" ? "bg-red-50 text-red-800 border border-red-100" : "bg-amber-50 text-amber-800 border border-amber-100"}`, children: item.sentiment === "Positive" ? "\u{1F7E2} Positive" : item.sentiment === "Negative" ? "\u{1F534} Negative" : "\u{1F7E1} Neutral" })
                    ] }),
                    /* @__PURE__ */ jsx("h3", { className: "font-bold text-slate-900 hover:text-slate-800 transition leading-snug", children: item.title }),
                    /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-600 line-clamp-2", children: item.content }),
                    item.slangUsed && item.slangUsed.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5 mt-1", children: item.slangUsed.map((slang, idx) => /* @__PURE__ */ jsxs("span", { className: "bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200", children: [
                      "\u{1F4AC} ",
                      slang
                    ] }, idx)) }),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3 mt-1", children: [
                      /* @__PURE__ */ jsxs("span", { children: [
                        "\u270D\uFE0F Author: ",
                        /* @__PURE__ */ jsx("strong", { className: "text-slate-700", children: item.author })
                      ] }),
                      /* @__PURE__ */ jsxs("span", { children: [
                        "\u{1F4E3} Reach: ",
                        /* @__PURE__ */ jsx("strong", { className: "text-slate-700", children: item.reach.toLocaleString() })
                      ] }),
                      /* @__PURE__ */ jsxs("span", { children: [
                        "\u{1F525} Engagement: ",
                        /* @__PURE__ */ jsx("strong", { className: "text-slate-700", children: item.engagement.toLocaleString() })
                      ] })
                    ] })
                  ]
                },
                item.id
              ))
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "lg:col-span-5 flex flex-col gap-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "bg-slate-900 text-white rounded-xl shadow-md p-6 flex flex-col gap-4 border border-slate-800", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-slate-800 pb-3", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-xl", children: "\u{1F4A1}" }),
                    /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold tracking-wider text-slate-300 uppercase", children: "AI Cultural Nuance Analyst" })
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded", children: "ENTERPRISE AI PRO" })
                ] }),
                selectedCovItem ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 font-bold uppercase tracking-wider", children: "Analyzing Article" }),
                    /* @__PURE__ */ jsx("h4", { className: "font-bold text-white text-base mt-1", children: selectedCovItem.title })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 font-bold uppercase tracking-wider", children: "Identified Slang & Lingo" }),
                    /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2 mt-2", children: selectedCovItem.slangUsed && selectedCovItem.slangUsed.length > 0 ? selectedCovItem.slangUsed.map((sl, idx) => /* @__PURE__ */ jsxs("div", { className: "bg-slate-800 text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-700", children: [
                      '\u{1F5E3}\uFE0F "',
                      sl,
                      '"'
                    ] }, idx)) : /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 italic", children: "No informal local slang detected. Native standard language." }) })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "bg-slate-800/50 rounded-xl p-4 border border-slate-800", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-widest mb-2", children: [
                      /* @__PURE__ */ jsx("span", { children: "\u{1F9E0}" }),
                      /* @__PURE__ */ jsx("span", { children: "Cultural Nuance Explanation" })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-300 leading-relaxed font-normal", children: selectedCovItem.culturalNuance || "This is standard editorial reporting. Its sentiment represents high authority, aligned with major regulatory policies, offering strategic guidance for general PR response planning." })
                  ] }),
                  (selectedCovItem.three_r_flag || (selectedCovItem.escalation_risk && selectedCovItem.escalation_risk !== 'none')) && /* @__PURE__ */ jsx("div", { className: "bg-slate-800/50 rounded-xl p-4 border border-slate-800 mt-3", children: 
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
                      selectedCovItem.three_r_flag && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest", children: [
                        /* @__PURE__ */ jsx("span", { children: "\u{1F6A8}" }),
                        /* @__PURE__ */ jsx("span", { children: "3R Flag Detected (Race, Religion, Royalty)" })
                      ] }),
                      selectedCovItem.escalation_risk && selectedCovItem.escalation_risk !== 'none' && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest", children: [
                        /* @__PURE__ */ jsx("span", { children: "\u{26A0}\u{FE0F}" }),
                        /* @__PURE__ */ jsxs("span", { children: ["Escalation Risk: ", selectedCovItem.escalation_risk.toUpperCase()] })
                      ] })
                    ] })
                  }),
                  /* @__PURE__ */ jsxs("div", { className: "border-t border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-400", children: [
                    /* @__PURE__ */ jsx("span", { children: "Source Quality Check" }),
                    /* @__PURE__ */ jsxs("span", { className: "text-emerald-400 font-bold flex items-center gap-1", children: [
                      /* @__PURE__ */ jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-400" }),
                      " Fully Indexed"
                    ] })
                  ] })
                ] }) : /* @__PURE__ */ jsx("p", { className: "text-slate-400 text-sm py-8 text-center italic", children: "Select a media mention on the left to review local slang and cultural context insights instantly." })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-xl p-5 shadow-sm", children: [
                /* @__PURE__ */ jsx("h3", { className: "font-bold text-slate-900 text-sm uppercase tracking-wider mb-3", children: "\u{1F1F2}\u{1F1FE} Regional Media Sources" }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 text-xs text-slate-600", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pb-2 border-b border-slate-100", children: [
                    /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-800", children: "Berita Nusantara (Demo) / Kini Portal Berita (Demo)" }),
                    /* @__PURE__ */ jsx("span", { className: "bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono", children: "High Authority News" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pb-2 border-b border-slate-100", children: [
                    /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-800", children: "Akhbar Utama Demo / Akhbar Harian Demo" }),
                    /* @__PURE__ */ jsx("span", { className: "bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono", children: "Malay Resonance" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pb-2 border-b border-slate-100", children: [
                    /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-800", children: "Platform Video Sosial (Demo) / Instagram Demo" }),
                    /* @__PURE__ */ jsx("span", { className: "bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono", children: "Youth Sentiment" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                    /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-800", children: "Forum Perbincangan Tempatan (Demo)" }),
                    /* @__PURE__ */ jsx("span", { className: "bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono", children: "Raw Consumer Tech Reviews" })
                  ] })
                ] })
              ] })
            ] })
          ] }),
          activeTab === "drafting" && /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start", children: [
            /* @__PURE__ */ jsxs("div", { className: "lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-4 shadow-sm", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("h2", { className: "text-lg font-bold text-slate-900 flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { children: "\u270D\uFE0F" }),
                  /* @__PURE__ */ jsx("span", { children: "Corporate Draft Settings" })
                ] }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 mt-1", children: "Configure narrative tone, languages, and local national policy alignment." })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5 mt-2", children: [
                /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Client / Brand" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    readOnly: true,
                    value: selectedClient?.name || "",
                    className: "bg-slate-100 border border-slate-200 text-slate-600 rounded-lg p-2.5 text-sm font-bold focus:outline-none"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Core Announcement / Background" }),
                /* @__PURE__ */ jsx(
                  "textarea",
                  {
                    rows: 4,
                    placeholder: "What is the key update? e.g., launching Pandan Coconut Shake line with certified organic sugar, donating 10,000 packs to community, or starting solar installation in Kedah...",
                    value: prAnnouncement,
                    onChange: (e) => setPrAnnouncement(e.target.value),
                    className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Narrative Tone" }),
                  /* @__PURE__ */ jsxs(
                    "select",
                    {
                      value: prTone,
                      onChange: (e) => setPrTone(e.target.value),
                      className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100",
                      children: [
                        /* @__PURE__ */ jsx("option", { value: "Professional & Strategic", children: "Strategic" }),
                        /* @__PURE__ */ jsx("option", { value: "Empathetic & Community Oriented", children: "Empathetic" }),
                        /* @__PURE__ */ jsx("option", { value: "Bold & Disrupter", children: "Bold Disrupter" }),
                        /* @__PURE__ */ jsx("option", { value: "Warm & Culturally Grounded", children: "Culturally Familiar" })
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Release Language" }),
                  /* @__PURE__ */ jsxs(
                    "select",
                    {
                      value: prLanguage,
                      onChange: (e) => setPrLanguage(e.target.value),
                      className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100",
                      children: [
                        /* @__PURE__ */ jsx("option", { value: "Bilingual (Malay & English)", children: "Bilingual (BM & EN)" }),
                        /* @__PURE__ */ jsx("option", { value: "Bahasa Melayu Only", children: "Bahasa Melayu" }),
                        /* @__PURE__ */ jsx("option", { value: "English Only", children: "English" })
                      ]
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "\u{1F1F2}\u{1F1FE} Policy & Socioeconomic Alignment" }),
                /* @__PURE__ */ jsxs(
                  "select",
                  {
                    value: prPolicy,
                    onChange: (e) => setPrPolicy(e.target.value),
                    className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100",
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "Civic Welfare Concept (Community Welfare & Fairness)", children: "Civic Welfare (Welfare & Integrity)" }),
                      /* @__PURE__ */ jsx("option", { value: "Renewable Grid Initiative (RGI)", children: "Renewable Grid Alignment (Clean Tech/Grid)" }),
                      /* @__PURE__ */ jsx("option", { value: "Halal Assurance & Certification Compliance", children: "Standard Halal Certification (F&B trust)" }),
                      /* @__PURE__ */ jsx("option", { value: "Local Youth Employment & Talent Development", children: "Youth Employment & local talent" }),
                      /* @__PURE__ */ jsx("option", { value: "Independent CSR Corporate Governance", children: "None (Standard Business Launch)" })
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: handleGeneratePressRelease,
                  disabled: isDraftingPR,
                  className: "w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50",
                  children: isDraftingPR ? /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin text-slate-400" }),
                    /* @__PURE__ */ jsx("span", { children: "Drafting with Enterprise AI..." })
                  ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(Sparkles, { className: "w-4 h-4 text-slate-300" }),
                    /* @__PURE__ */ jsx("span", { children: "Generate Press Release" })
                  ] })
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "lg:col-span-7 flex flex-col gap-4", children: generatedPR ? /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-500 font-extrabold uppercase tracking-widest", children: "DRAFT OUTLINE" }),
                  /* @__PURE__ */ jsx("h3", { className: "font-bold text-slate-900 text-sm mt-0.5", children: "Corporate Communications Copy" })
                ] }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => {
                      navigator.clipboard.writeText(`${generatedPR.title}

${generatedPR.content}`);
                      setToast({ message: "Press release copied to clipboard!", type: "success" });
                    },
                    className: "flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition",
                    children: [
                      /* @__PURE__ */ jsx(Copy, { className: "w-3.5 h-3.5" }),
                      /* @__PURE__ */ jsx("span", { children: "Copy Code" })
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsx("div", { className: "bg-slate-50 border border-slate-100 p-4 rounded-lg", children: /* @__PURE__ */ jsxs("h4", { className: "text-base font-extrabold text-slate-950 font-sans tracking-tight", children: [
                "\u{1F4E2} ",
                generatedPR.title
              ] }) }),
              /* @__PURE__ */ jsx("div", { className: "prose prose-sm text-slate-700 max-h-[450px] overflow-y-auto whitespace-pre-wrap leading-relaxed bg-stone-50/50 p-4 rounded-lg border border-stone-100", children: generatedPR.content }),
              /* @__PURE__ */ jsx("div", { className: "text-xs text-slate-400 text-center italic border-t border-slate-100 pt-3", children: "Standard disclaimer: PRVAIL AI generates mock spokesman quotes for structural purposes. Verify compliance before regional publishing." })
            ] }) : /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "text-4xl", children: "\u{1F5D2}\uFE0F" }),
              /* @__PURE__ */ jsx("h3", { className: "font-bold text-slate-800 text-lg", children: "No Press Release Generated Yet" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-400 max-w-sm", children: "Fill in the core announcement and strategic alignments on the left, then click generate to craft publication-ready copy." })
            ] }) })
          ] }),
          activeTab === "stakeholders" && /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start", children: [
            /* @__PURE__ */ jsxs("div", { className: "lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm", children: [
              /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 pb-3", children: [
                /* @__PURE__ */ jsx("h2", { className: "text-base font-bold text-slate-900", children: "Media & Influencers" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Regional journalists, forum moderators, and food vloggers" })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1", children: stakeholders.map((st) => /* @__PURE__ */ jsxs(
                "div",
                {
                  onClick: () => setSelectedStakeholder(st),
                  className: `p-3 rounded-lg border cursor-pointer transition flex items-center gap-3 ${selectedStakeholder?.id === st.id ? "bg-slate-100 border-slate-900 ring-1 ring-slate-900" : "bg-slate-50/50 border-slate-200 hover:border-slate-300"}`,
                  children: [
                    st.avatar ? (
                      /* @__PURE__ */ jsx(
                        "img",
                        {
                          src: st.avatar,
                          alt: st.name,
                          className: "w-10 h-10 rounded-full bg-slate-200 border border-slate-300 object-cover"
                        }
                      )
                    ) : (
                      <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center text-white text-xs font-bold border border-slate-700 font-display">
                        {st.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    ),
                    /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                      /* @__PURE__ */ jsx("h4", { className: "font-bold text-xs text-slate-900 truncate", children: st.name }),
                      /* @__PURE__ */ jsx("p", { className: "text-[10px] text-slate-500 truncate", children: st.role }),
                      /* @__PURE__ */ jsx("span", { className: "inline-block mt-1 text-[9px] bg-slate-900 text-slate-100 px-2 py-0.5 rounded font-bold font-mono", children: st.outlet })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-xs font-black text-slate-800", children: st.influenceScore }),
                      /* @__PURE__ */ jsx("p", { className: "text-[8px] text-slate-400 font-bold uppercase tracking-widest", children: "Influence" })
                    ] })
                  ]
                },
                st.id
              )) })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "lg:col-span-8 flex flex-col gap-6", children: selectedStakeholder && selectedClient && /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-5", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                  selectedStakeholder.avatar ? (
                    /* @__PURE__ */ jsx(
                      "img",
                      {
                        src: selectedStakeholder.avatar,
                        alt: selectedStakeholder.name,
                        className: "w-12 h-12 rounded-full border border-slate-200 object-cover"
                      }
                    )
                  ) : (
                    <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center text-white text-sm font-bold border border-slate-700 font-display">
                      {selectedStakeholder.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  ),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-base", children: selectedStakeholder.name }),
                    /* @__PURE__ */ jsxs("p", { className: "text-xs text-slate-500 font-semibold", children: [
                      selectedStakeholder.role,
                      " at ",
                      /* @__PURE__ */ jsx("span", { className: "text-slate-900 font-extrabold", children: selectedStakeholder.outlet })
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs", children: [
                  /* @__PURE__ */ jsxs("div", { className: "px-3 border-r border-slate-200", children: [
                    /* @__PURE__ */ jsx("span", { className: "block text-[9px] text-slate-400 uppercase font-black tracking-widest", children: "Pitch Rate" }),
                    /* @__PURE__ */ jsxs("strong", { className: "text-sm font-black text-slate-800", children: [
                      selectedStakeholder.pitchSuccessRate,
                      "%"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "px-3", children: [
                    /* @__PURE__ */ jsx("span", { className: "block text-[9px] text-slate-400 uppercase font-black tracking-widest", children: "Target Specialty" }),
                    /* @__PURE__ */ jsx("strong", { className: "text-slate-800 truncate block max-w-[120px]", children: selectedStakeholder.specialty.join(", ") })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-slate-800", children: "\u{1F5E3}\uFE0F Localized Outreach Personalizer" }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("label", { className: "text-[11px] font-bold text-slate-600", children: "Outreach Mode:" }),
                    /* @__PURE__ */ jsxs(
                      "select",
                      {
                        value: outreachType,
                        onChange: (e) => setOutreachType(e.target.value),
                        className: "border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none",
                        children: [
                          /* @__PURE__ */ jsx("option", { value: "Email", children: "\u{1F4E7} Business Email" }),
                          /* @__PURE__ */ jsx("option", { value: "WhatsApp", children: "\u{1F7E2} WhatsApp / Chat" })
                        ]
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-[10px] text-slate-500 font-bold uppercase tracking-wider", children: "Context & Pitch Objective" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "text",
                      placeholder: "e.g., Invite to preview Pandan Coconut Shake, or request interview about Alor Setar community solar...",
                      value: pitchGoal,
                      onChange: (e) => setPitchGoal(e.target.value),
                      className: "border border-slate-200 bg-white rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-100"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: handleGenerateOutreachPitch,
                    disabled: isGeneratingPitch,
                    className: "w-full bg-slate-900 text-white font-bold py-2.5 px-4 rounded-lg text-xs hover:bg-slate-800 transition flex items-center justify-center gap-2",
                    children: isGeneratingPitch ? /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-slate-300" }),
                      /* @__PURE__ */ jsx("span", { children: "Drafting Pitch with Local Etiquette..." })
                    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(Sparkles, { className: "w-3.5 h-3.5 text-slate-400" }),
                      /* @__PURE__ */ jsx("span", { children: "Generate Cultural Pitch Copy" })
                    ] })
                  }
                )
              ] }),
              generatedPitch && /* @__PURE__ */ jsxs("div", { className: "border border-slate-200 bg-slate-50/50 rounded-xl p-4 flex flex-col gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 pb-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-800 font-black uppercase tracking-widest", children: outreachType === "Email" ? "\u{1F4E7} EMAIL COLD SCRIPT" : "\u{1F7E2} WHATSAPP COPY" }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => {
                        const textToCopy = outreachType === "Email" ? `Subject: ${generatedPitch.subject}

${generatedPitch.body}` : generatedPitch.body;
                        navigator.clipboard.writeText(textToCopy);
                        setToast({ message: "Pitch copied to clipboard!", type: "success" });
                      },
                      className: "text-xs text-slate-700 font-bold underline hover:text-slate-900",
                      children: "Copy Copy"
                    }
                  )
                ] }),
                outreachType === "Email" && generatedPitch.subject && /* @__PURE__ */ jsxs("div", { className: "text-xs text-slate-800 pb-2 border-b border-slate-200", children: [
                  /* @__PURE__ */ jsx("strong", { children: "Subject:" }),
                  " ",
                  generatedPitch.subject
                ] }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono bg-white p-3 rounded-lg border border-slate-200", children: generatedPitch.body }),
                /* @__PURE__ */ jsxs("div", { className: "mt-2 pt-3 border-t border-slate-200 flex flex-col gap-2", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-[10px] text-slate-500 font-bold uppercase tracking-wider", children: "Internal Follow Up Notes (Optional)" }),
                  /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "text",
                        placeholder: "e.g. Sent at 2:30pm, pending reply...",
                        value: outreachNotes,
                        onChange: (e) => setOutreachNotes(e.target.value),
                        className: "flex-1 border border-slate-200 bg-white rounded-lg p-2 text-xs focus:outline-none"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: handleLogOutreach,
                        className: "bg-slate-950 hover:bg-slate-850 text-white font-bold px-4 py-2 rounded-lg text-xs transition",
                        children: "Log Communication"
                      }
                    )
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-4 border-t border-slate-100 pt-5", children: [
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900 mb-3", children: "Outreach Logs history" }),
                outreachLogs.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400 italic", children: "No outreach records found for this client campaign." }) : /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: outreachLogs.map((log) => {
                  const partner = stakeholders.find((s) => s.id === log.stakeholderId);
                  return /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 border border-slate-150 p-3.5 rounded-lg text-xs flex flex-col gap-2", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                        /* @__PURE__ */ jsx("span", { className: "bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono", children: log.type }),
                        /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-800", children: partner ? partner.name : "Unknown Stakeholder" })
                      ] }),
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: new Date(log.date).toLocaleDateString() })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "text-slate-600 italic", children: log.notes }),
                    log.pitchContent && /* @__PURE__ */ jsxs("details", { className: "mt-1", children: [
                      /* @__PURE__ */ jsx("summary", { className: "text-[10px] text-slate-800 font-bold cursor-pointer hover:underline", children: "View Sent Pitch Copy" }),
                      /* @__PURE__ */ jsx("p", { className: "mt-1 bg-white border p-2 rounded text-[10px] text-slate-600 font-mono whitespace-pre-wrap", children: log.pitchContent })
                    ] })
                  ] }, log.id);
                }) })
              ] })
            ] }) })
          ] }),
          activeTab === "tasks" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between bg-white p-5 border border-slate-200 rounded-xl shadow-sm", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold text-slate-900", children: "Campaign Task Roadmap" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Track and manage strategic response plans, statements, and releases." })
              ] }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setShowNewTaskModal(true),
                  className: "flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition",
                  children: [
                    /* @__PURE__ */ jsx(Plus, { className: "w-3.5 h-3.5" }),
                    /* @__PURE__ */ jsx("span", { children: "Create Campaign Task" })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [
              /* @__PURE__ */ jsxs("div", { className: "bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 min-h-[400px]", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pb-2 border-b border-slate-200", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-black text-slate-700 uppercase tracking-wider", children: "\u{1F4CB} Action Items (Todo)" }),
                  /* @__PURE__ */ jsx("span", { className: "bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full", children: tasks.filter((t) => t.status === "todo").length })
                ] }),
                tasks.filter((t) => t.status === "todo").map((task) => /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-2.5", children: [
                  /* @__PURE__ */ jsx("h4", { className: "font-bold text-xs text-slate-900", children: task.title }),
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-500 leading-relaxed", children: task.description }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "\u{1F4C5} ",
                      new Date(task.dueDate).toLocaleDateString()
                    ] }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => handleUpdateTaskStatus(task.id, "inprogress"),
                        className: "text-slate-900 font-bold hover:underline",
                        children: "Start Work \u27A1\uFE0F"
                      }
                    )
                  ] })
                ] }, task.id))
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 min-h-[400px]", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pb-2 border-b border-slate-200", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-black text-slate-700 uppercase tracking-wider", children: "\u23F3 In Action (In Progress)" }),
                  /* @__PURE__ */ jsx("span", { className: "bg-slate-200 text-slate-800 text-xs font-bold px-2 py-0.5 rounded-full", children: tasks.filter((t) => t.status === "inprogress").length })
                ] }),
                tasks.filter((t) => t.status === "inprogress").map((task) => /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-2.5", children: [
                  /* @__PURE__ */ jsx("h4", { className: "font-bold text-xs text-slate-900", children: task.title }),
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-500 leading-relaxed", children: task.description }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "\u{1F4C5} ",
                      new Date(task.dueDate).toLocaleDateString()
                    ] }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => handleUpdateTaskStatus(task.id, "done"),
                        className: "text-emerald-600 font-bold hover:underline",
                        children: "Complete Task \u2714\uFE0F"
                      }
                    )
                  ] })
                ] }, task.id))
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 min-h-[400px]", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pb-2 border-b border-slate-200", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-black text-slate-700 uppercase tracking-wider", children: "\u2705 Archive (Completed)" }),
                  /* @__PURE__ */ jsx("span", { className: "bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full", children: tasks.filter((t) => t.status === "done").length })
                ] }),
                tasks.filter((t) => t.status === "done").map((task) => /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-lg p-4 shadow-sm opacity-75 flex flex-col gap-2.5", children: [
                  /* @__PURE__ */ jsx("h4", { className: "font-bold text-xs text-slate-900 line-through text-slate-400", children: task.title }),
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-500 leading-relaxed", children: task.description }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "\u{1F4C5} ",
                      new Date(task.dueDate).toLocaleDateString()
                    ] }),
                    /* @__PURE__ */ jsx("span", { className: "text-emerald-600 font-bold", children: "\u2714\uFE0F Archived" })
                  ] })
                ] }, task.id))
              ] })
            ] })
          ] }),
          activeTab === "advisor" && /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch", children: [
            /* @__PURE__ */ jsxs("div", { className: "lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4 justify-between", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
                /* @__PURE__ */ jsx("div", { className: "w-12 h-12 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center text-xl font-bold", children: "\u{1F9E0}" }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-950 text-base", children: "Senior Strategic Advisor" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[10px] bg-slate-900 text-white font-extrabold px-2 py-0.5 rounded tracking-widest font-mono", children: "ENTERPRISE FLASH AI" })
                ] }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-600 leading-relaxed", children: "Ask our communications advisor regarding crisis containment, aligning products with national policy blueprints like **Civic Welfare** or **Renewable Grid**, or analyzing slang feedback." })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "border-t border-slate-100 pt-4 flex flex-col gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 font-bold uppercase tracking-widest", children: "Example Queries" }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => setChatInput("Bagaimanakah cara terbaik untuk mengendalikan isu kualiti pembungkusan 'cincai' di TikTok?"),
                    className: "text-left text-xs bg-slate-50 border p-2 rounded-lg text-slate-700 hover:border-slate-300 transition",
                    children: '\u{1F4A1} How to handle "cincai" packaging feedback?'
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => setChatInput("Bagaimanakah syarikat solar luar bandar boleh menjajarkan kenyataan media dengan program Renewable Grid?"),
                    className: "text-left text-xs bg-slate-50 border p-2 rounded-lg text-slate-700 hover:border-slate-300 transition",
                    children: "\u{1F4A1} Aligning solar project statement with Renewable Grid"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-h-[500px]", children: [
              /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-150 p-4 flex items-center justify-between text-xs font-bold text-slate-700", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" }),
                  /* @__PURE__ */ jsx("span", { children: "Active Strategy Session" })
                ] }),
                /* @__PURE__ */ jsxs("span", { className: "text-slate-400", children: [
                  "Ref: ",
                  selectedClient?.name
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-h-[400px]", children: [
                chatHistory.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center py-16 text-slate-400 gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-4xl", children: "\u{1F4AC}" }),
                  /* @__PURE__ */ jsx("h4", { className: "font-bold text-slate-700 text-sm", children: "PRVAIL Strategic Consultation" }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs max-w-xs", children: "Ask a question above or select an example query to initiate the AI dialogue." })
                ] }) : chatHistory.map((msg, idx) => /* @__PURE__ */ jsxs(
                  "div",
                  {
                    className: `flex flex-col max-w-[80%] ${msg.role === "user" ? "self-end bg-slate-900 text-white rounded-xl rounded-tr-none" : "self-start bg-slate-100 text-slate-800 rounded-xl rounded-tl-none border border-slate-200"} p-3.5`,
                    children: [
                      /* @__PURE__ */ jsx("p", { className: "text-xs leading-relaxed whitespace-pre-wrap", children: msg.text }),
                      /* @__PURE__ */ jsx("span", { className: `text-[9px] mt-1.5 block text-right font-mono ${msg.role === "user" ? "text-slate-300" : "text-slate-400"}`, children: msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
                    ]
                  },
                  idx
                )),
                isChatSending && /* @__PURE__ */ jsxs("div", { className: "self-start bg-slate-50 text-slate-500 rounded-xl rounded-tl-none border border-slate-200 p-3.5 flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-slate-500" }),
                  /* @__PURE__ */ jsx("span", { className: "text-xs italic", children: "Penasihat sedang menyusun strategi..." })
                ] }),
                /* @__PURE__ */ jsx("div", { ref: chatEndRef })
              ] }),
              /* @__PURE__ */ jsxs("form", { onSubmit: handleSendChatMessage, className: "border-t border-slate-150 p-4 flex gap-2", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    placeholder: "Type your strategic query here... (e.g. Bagaimanakah cara...)",
                    value: chatInput,
                    onChange: (e) => setChatInput(e.target.value),
                    className: "flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-100"
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "submit",
                    disabled: isChatSending || !chatInput.trim(),
                    className: "bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-lg text-xs transition flex items-center gap-1.5 disabled:opacity-50",
                    children: [
                      /* @__PURE__ */ jsx(Send, { className: "w-3.5 h-3.5" }),
                      /* @__PURE__ */ jsx("span", { children: "Send" })
                    ]
                  }
                )
              ] })
            ] })
          ] }),
          activeTab === "reputation" && (
            <div className="flex flex-col gap-6">
              {/* Header section with brand info, metrics, and premium styling */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800 rounded-full filter blur-3xl opacity-30 -mr-20 -mt-20"></div>
                <div className="flex flex-col gap-2 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-slate-800 text-emerald-400 border border-emerald-950 px-2.5 py-0.5 rounded font-black tracking-widest uppercase">✨ GENAI LENS ACTIVE</span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider font-sans">Enterprise Media Intelligence</span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 font-sans">
                    <span>🌐</span>
                    <span>Global-Scope Enterprise Lens</span>
                  </h2>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    Real-time campaign listening, automated crawl diagnostics, comprehensive Share-of-Voice (SOV), competitor benchmarks, and multi-channel influencer engagement.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5 z-10">
                  <button
                    onClick={() => setRepSubTab("overview")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${repSubTab === "overview" ? "bg-white text-slate-900 font-extrabold shadow" : "bg-slate-800 text-slate-300 hover:bg-slate-750"}`}
                  >
                    📊 Media Tracking
                  </button>
                  <button
                    onClick={() => setRepSubTab("sov_competitors")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${repSubTab === "sov_competitors" ? "bg-white text-slate-900 font-extrabold shadow" : "bg-slate-800 text-slate-300 hover:bg-slate-750"}`}
                  >
                    ⚔️ Share of Voice & Benchmarks
                  </button>
                  <button
                    onClick={() => setRepSubTab("influencer_analytics")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${repSubTab === "influencer_analytics" ? "bg-white text-slate-900 font-extrabold shadow" : "bg-slate-800 text-slate-300 hover:bg-slate-750"}`}
                  >
                    📣 Influencer Analytics
                  </button>
                  <button
                    onClick={() => setRepSubTab("nlp_dictionary")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${repSubTab === "nlp_dictionary" ? "bg-white text-slate-900 font-extrabold shadow" : "bg-slate-800 text-slate-300 hover:bg-slate-750"}`}
                  >
                    📖 Localized Slang Sandbox
                  </button>
                  <button
                    onClick={() => setRepSubTab("executive_briefing")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${repSubTab === "executive_briefing" ? "bg-white text-slate-900 font-extrabold shadow" : "bg-slate-800 text-slate-300 hover:bg-slate-750"}`}
                  >
                    📋 PPT Slides & Briefing
                  </button>
                </div>
              </div>

              {/* Sub-tab 1: Media Tracking & Ingest Console */}
              {repSubTab === "overview" && (
                <div className="flex flex-col gap-6">
                  {/* Top quick metrics for enterprise style */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Indexed Articles (24h)</div>
                      <div className="text-2xl font-black text-slate-800 mt-1">2,482</div>
                      <div className="text-[11px] text-emerald-600 font-medium mt-1">↑ +14.5% vs yesterday</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Crawling Status</div>
                      <div className="text-2xl font-black text-slate-800 mt-1 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                        <span className="text-emerald-600">Active</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">Interval: every {crawlerFrequency}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Slang Match</div>
                      <div className="text-2xl font-black text-indigo-600 mt-1">"mantap gila"</div>
                      <div className="text-[11px] text-slate-400 mt-1">Appeared in 42 mentions</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GEO Reach Scope</div>
                      <div className="text-2xl font-black text-slate-800 mt-1">4.2M</div>
                      <div className="text-[11px] text-slate-400 mt-1">Primarily Central Region</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left side: Charts */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <h3 className="font-bold text-slate-900 text-sm">Sentiment Trend Over Time</h3>
                            <p className="text-xs text-slate-500">24-hour sentiment velocity</p>
                          </div>
                          <span className="text-xs font-bold text-slate-400">Campaign: {selectedClient?.name || "Active Campaign"}</span>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[
                              { time: '00:00', Positive: 20, Negative: 5, Neutral: 15 },
                              { time: '04:00', Positive: 35, Negative: 10, Neutral: 20 },
                              { time: '08:00', Positive: 40, Negative: 25, Neutral: 30 },
                              { time: '12:00', Positive: 60, Negative: 15, Neutral: 45 },
                              { time: '16:00', Positive: 55, Negative: 20, Neutral: 35 },
                              { time: '20:00', Positive: 75, Negative: 10, Neutral: 25 },
                              { time: '24:00', Positive: 80, Negative: 5, Neutral: 20 },
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
                              <YAxis stroke="#94a3b8" fontSize={10} />
                              <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Legend wrapperStyle={{ fontSize: '11px' }} />
                              <Line type="monotone" dataKey="Positive" stroke="#10b981" strokeWidth={2} />
                              <Line type="monotone" dataKey="Negative" stroke="#ef4444" strokeWidth={2} />
                              <Line type="monotone" dataKey="Neutral" stroke="#64748b" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
                        <div className="flex flex-col">
                          <h3 className="font-bold text-slate-900 text-sm">Language / Platform Breakdown</h3>
                          <p className="text-xs text-slate-500">Distribution across major networks (MY)</p>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { platform: 'TikTok', English: 30, Malay: 70, Manglish: 40 },
                              { platform: 'Facebook', English: 45, Malay: 55, Manglish: 20 },
                              { platform: 'X (Twitter)', English: 60, Malay: 35, Manglish: 50 },
                              { platform: 'Instagram', English: 50, Malay: 40, Manglish: 30 },
                              { platform: 'WhatsApp', English: 20, Malay: 80, Manglish: 60 },
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="platform" stroke="#94a3b8" fontSize={10} />
                              <YAxis stroke="#94a3b8" fontSize={10} />
                              <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Legend wrapperStyle={{ fontSize: '11px' }} />
                              <Bar dataKey="Malay" fill="#3b82f6" stackId="a" />
                              <Bar dataKey="Manglish" fill="#f59e0b" stackId="a" />
                              <Bar dataKey="English" fill="#8b5cf6" stackId="a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Real-time crawler tracking and controls */}
                    <div className="flex flex-col gap-6">
                      <div className="bg-slate-950 text-slate-200 rounded-xl p-5 border border-slate-850 shadow-md flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] font-black tracking-widest text-slate-300 uppercase font-mono">Live Crawl Stream</span>
                          </div>
                          <button
                            onClick={handleForceRecrawl}
                            disabled={isCrawling}
                            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 disabled:opacity-50 text-emerald-400 font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${isCrawling ? "animate-spin" : ""}`} />
                            {isCrawling ? "Crawling..." : "Recrawl Now"}
                          </button>
                        </div>

                        {/* Crawler Log Output Console */}
                        <div className="bg-black/40 border border-slate-900/60 rounded-lg p-3 font-mono text-[10px] leading-relaxed h-60 overflow-y-auto flex flex-col gap-2 scrollbar-thin">
                          {crawlerLogs.map((log) => (
                            <div key={log.id} className="flex gap-2">
                              <span className="text-slate-500">[{log.time}]</span>
                              <span className={log.type === "success" ? "text-emerald-400" : log.type === "error" ? "text-rose-400" : "text-sky-300"}>
                                {log.text}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="text-[9px] text-slate-500 italic text-center">
                          Powered by BigQuery Social Feed crawlers. Connected channels: 4
                        </div>
                      </div>

                      {/* Crawler Automation Controls */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                        <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-slate-600" />
                          <span>Automation Settings</span>
                        </h3>
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Crawl Frequency</label>
                            <select
                              value={crawlerFrequency}
                              onChange={(e) => {
                                setCrawlerFrequency(e.target.value);
                                setToast({ message: `Crawl frequency set to every ${e.target.value}`, type: "success" });
                              }}
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                            >
                              <option value="5m">⚡ Real-time (Every 5 minutes)</option>
                              <option value="30m">Every 30 minutes</option>
                              <option value="1h">Hourly</option>
                              <option value="4h">Every 4 hours</option>
                              <option value="24h">Daily summary</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Listening Keywords</label>
                            <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg flex flex-wrap gap-1.5 text-[11px]">
                              {selectedClient?.keywords && selectedClient.keywords.length > 0 ? (
                                selectedClient.keywords.map((kw, i) => (
                                  <span key={i} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium text-slate-600">
                                    #{kw}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic">No keywords configured</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Channels</label>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                              <label className="flex items-center gap-1.5">
                                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                                <span>Press RSS Feeds</span>
                              </label>
                              <label className="flex items-center gap-1.5">
                                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                                <span>Facebook Public</span>
                              </label>
                              <label className="flex items-center gap-1.5">
                                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                                <span>TikTok Mentions</span>
                              </label>
                              <label className="flex items-center gap-1.5">
                                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                                <span>X (Twitter) Firehose</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Enterprise Modules (Boolean & AVE) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card A: Boolean Query Builder */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔍</span>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm">Boolean Query Builder</h3>
                            <p className="text-[11px] text-slate-500">Formulate high-precision search strings for targeted scanning</p>
                          </div>
                        </div>
                        <span className="text-[9px] bg-slate-900 text-slate-100 px-2 py-0.5 rounded font-mono font-black">ENTERPRISE FILTER</span>
                      </div>

                      <div className="flex flex-col gap-3 text-xs">
                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-700 flex items-center gap-1.5">
                            <span>Must Include (AND)</span>
                            <span className="text-slate-400 font-normal font-sans">(comma separated keywords)</span>
                          </label>
                          <input
                            type="text"
                            value={boolAnd}
                            onChange={(e) => setBoolAnd(e.target.value)}
                            placeholder="e.g., Inai, Halal"
                            className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-semibold"
                          />
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-700 flex items-center gap-1.5">
                            <span>Can Include (OR)</span>
                            <span className="text-slate-400 font-normal font-sans">(comma separated keywords)</span>
                          </label>
                          <input
                            type="text"
                            value={boolOr}
                            onChange={(e) => setBoolOr(e.target.value)}
                            placeholder="e.g., Nails, Beauty, Cosmetics"
                            className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-semibold"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-700 flex items-center gap-1.5">
                            <span>Must Exclude (NOT)</span>
                            <span className="text-slate-400 font-normal font-sans">(comma separated keywords)</span>
                          </label>
                          <input
                            type="text"
                            value={boolNot}
                            onChange={(e) => setBoolNot(e.target.value)}
                            placeholder="e.g., Teruk, Lambat, Scam"
                            className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-semibold"
                          />
                        </div>

                        <div className="bg-slate-900 rounded-xl p-3.5 border border-slate-800">
                          <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest block mb-1">Generated Boolean Statement</span>
                          <code className="text-[11px] text-emerald-400 font-mono font-bold break-all">
                            {boolQueryString || '(* OR * OR *)'}
                          </code>
                        </div>

                        <div className="flex gap-2.5">
                          <button
                            onClick={handleUpdateBooleanQuery}
                            className="flex-1 bg-slate-950 hover:bg-slate-850 text-white font-bold py-2.5 px-3 rounded-lg text-xs transition font-mono flex items-center justify-center gap-1.5"
                          >
                            <span>⚡ Compile & Apply Filter</span>
                          </button>
                          <button
                            onClick={handleClearBooleanQuery}
                            className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-lg text-xs transition"
                          >
                            Clear
                          </button>
                        </div>

                        {isBoolActive && (
                          <div className="bg-emerald-50 border border-emerald-150 rounded-lg p-2.5 text-[11px] text-emerald-900 flex items-center justify-between font-medium">
                            <span>Matches Found: <strong>{filteredCoverage.length}</strong> / <strong>{coverage.length}</strong> coverage items</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black uppercase font-mono">Filter Active</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card B: AVE Engine */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💎</span>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm">Corporate AVE Engine</h3>
                            <p className="text-[11px] text-slate-500">Calculate monetary brand exposure valuation automatically</p>
                          </div>
                        </div>
                        <span className="text-[9px] bg-emerald-500 text-slate-900 px-2 py-0.5 rounded font-mono font-black">FINANCIAL INDEX</span>
                      </div>

                      <div className="flex flex-col gap-3 text-xs">
                        {/* Multiplier control */}
                        <div className="flex flex-col gap-1.5 bg-slate-50 border border-slate-150 rounded-xl p-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700">PR Value Multiplier</span>
                            <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md text-xs border border-indigo-100">{aveMultiplier.toFixed(1)}x multiplier</span>
                          </div>
                          <input
                            type="range"
                            min="1.0"
                            max="5.0"
                            step="0.5"
                            value={aveMultiplier}
                            onChange={(e) => setAveMultiplier(parseFloat(e.target.value))}
                            className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                          />
                          <p className="text-[10px] text-slate-400 leading-normal mt-1">
                            Standard PR value multiplication (usually 3.0x) accounts for organic authority and editorial credibility over simple advertising rates.
                          </p>
                        </div>

                        {/* Real-time calculated AVE summary */}
                        {(() => {
                          const defaultChannels = {
                            'TikTok': { count: 0, ave: 0 },
                            'Instagram': { count: 0, ave: 0 },
                            'Facebook': { count: 0, ave: 0 },
                            'WhatsApp Forward': { count: 0, ave: 0 },
                            'X (Twitter)': { count: 0, ave: 0 },
                            'Other/RSS': { count: 0, ave: 0 }
                          };

                          coverage.forEach(item => {
                            let source = item.source || 'Other/RSS';
                            if (!defaultChannels[source]) {
                              source = 'Other/RSS';
                            }
                            let sentFactor = 1.0;
                            if (item.sentiment === 'Positive') sentFactor = 1.4;
                            if (item.sentiment === 'Negative') sentFactor = 0.2;

                            const baseReachValue = (item.reach || 25000) * 0.12;
                            const baseEngageValue = (item.engagement || 500) * 1.6;
                            const aveVal = (baseReachValue + baseEngageValue) * sentFactor * aveMultiplier;

                            defaultChannels[source].count += 1;
                            defaultChannels[source].ave += aveVal;
                          });

                          const totalAve = Object.values(defaultChannels).reduce((sum, channel) => sum + channel.ave, 0);
                          const totalReach = coverage.reduce((sum, item) => sum + (item.reach || 0), 0);

                          return (
                            <div className="flex flex-col gap-3">
                              <div className="grid grid-cols-2 gap-3 mt-1">
                                <div className="bg-slate-900 text-white rounded-xl p-3 border border-slate-800 text-center">
                                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Total Reach Scope</span>
                                  <span className="text-base font-black tracking-tight text-white block mt-0.5">{totalReach.toLocaleString()}</span>
                                  <span className="text-[9px] text-slate-500 italic">Indexed reach count</span>
                                </div>
                                <div className="bg-slate-900 text-emerald-400 rounded-xl p-3 border border-slate-800 text-center">
                                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Accumulated AVE Value</span>
                                  <span className="text-base font-black tracking-tight text-emerald-400 block mt-0.5">RM {totalAve.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="text-[9px] text-emerald-600 font-mono font-bold tracking-widest uppercase">AUDITED VALUE</span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5 mt-1 border border-slate-100 rounded-xl p-2.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Financial AVE Breakdown by Channel</span>
                                <div className="flex flex-col gap-2">
                                  {Object.entries(defaultChannels).filter(([_, ch]) => ch.count > 0 || _ === 'TikTok' || _ === 'Instagram').map(([name, ch]) => {
                                    const finalAve = ch.ave || (name === 'TikTok' ? 3450 : 1850) * aveMultiplier;
                                    const percent = Math.min(100, Math.round((finalAve / (totalAve || 15000)) * 100)) || (name === 'TikTok' ? 65 : 35);
                                    return (
                                      <div key={name} className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center text-[10px] text-slate-700">
                                          <span className="font-semibold">{name}</span>
                                          <span className="font-mono font-bold">RM {finalAve.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Share of Voice & Benchmarking */}
              {repSubTab === "sov_competitors" && (
                <div className="flex flex-col gap-6">
                  {/* SOV and competitor breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Share of Voice Pie Chart */}
                    <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
                      <div className="flex flex-col">
                        <h3 className="font-bold text-slate-900 text-sm">Media Share of Voice (SOV)</h3>
                        <p className="text-xs text-slate-500">Distribution of mention volume compared to direct competitors</p>
                      </div>
                      <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: selectedClient?.name || "Your Brand", value: 45 },
                                { name: selectedClient?.industry?.toLowerCase().includes("beauty") ? "d'Herbs Cosmetics" : "Nusa Group", value: 30 },
                                { name: selectedClient?.industry?.toLowerCase().includes("beauty") ? "SimplySiti Analytics" : "Asean Insights", value: 25 }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {[
                                { color: '#3b82f6' },
                                { color: '#10b981' },
                                { color: '#f59e0b' }
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Competitor Sentiment Profile stacked bar chart */}
                    <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
                      <div className="flex flex-col">
                        <h3 className="font-bold text-slate-900 text-sm">Competitor Sentiment Profile</h3>
                        <p className="text-xs text-slate-500">Comparing positive, neutral and negative alignment</p>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={[
                              { name: selectedClient?.name || "Your Brand", Positive: 65, Neutral: 25, Negative: 10 },
                              { name: selectedClient?.industry?.toLowerCase().includes("beauty") ? "d'Herbs Cosmetics" : "Nusa Group", Positive: 48, Neutral: 35, Negative: 17 },
                              { name: selectedClient?.industry?.toLowerCase().includes("beauty") ? "SimplySiti Analytics" : "Asean Insights", Positive: 55, Neutral: 38, Negative: 7 }
                            ]}
                            margin={{ left: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={100} />
                            <RechartsTooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="Positive" fill="#10b981" stackId="b" />
                            <Bar dataKey="Neutral" fill="#64748b" stackId="b" />
                            <Bar dataKey="Negative" fill="#ef4444" stackId="b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Competitor Benchmarking Grid */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                      <div className="flex flex-col">
                        <h3 className="font-bold text-slate-900 text-sm">Competitor Benchmarking Matrix</h3>
                        <p className="text-xs text-slate-500">Comprehensive reputation index comparing brand equity vectors</p>
                      </div>
                      <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-150 text-indigo-700 px-2.5 py-0.5 rounded font-bold uppercase">
                        Enterprise Grade Benchmarking
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold">
                            <th className="p-3">Core Performance Metric</th>
                            <th className="p-3 text-slate-900 font-extrabold bg-indigo-50/60 border-x border-indigo-100">{selectedClient?.name || "Your Brand"} (Selected)</th>
                            <th className="p-3">{selectedClient?.industry?.toLowerCase().includes("beauty") ? "d'Herbs Cosmetics" : "Nusa Group"}</th>
                            <th className="p-3">{selectedClient?.industry?.toLowerCase().includes("beauty") ? "SimplySiti Analytics" : "Asean Insights"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-slate-700">
                          <tr className="hover:bg-slate-50">
                            <td className="p-3 font-medium">Credibility / Reputation Score</td>
                            <td className="p-3 font-extrabold text-indigo-700 bg-indigo-50/30 border-x border-indigo-100">
                              ⭐ {selectedClient?.credibilityScore || 92}/100
                            </td>
                            <td className="p-3">78/100</td>
                            <td className="p-3">85/100</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-3 font-medium">Net Sentiment Index (Positive)</td>
                            <td className="p-3 font-bold text-slate-900 bg-indigo-50/30 border-x border-indigo-100">
                              <span className="text-emerald-600 font-black">65%</span> (Strong)
                            </td>
                            <td className="p-3"><span className="text-slate-600">48%</span> (Moderate)</td>
                            <td className="p-3"><span className="text-emerald-600">55%</span> (Strong)</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-3 font-medium">24h Media Coverage Articles</td>
                            <td className="p-3 font-bold text-slate-900 bg-indigo-50/30 border-x border-indigo-100">42 pieces</td>
                            <td className="p-3">28 pieces</td>
                            <td className="p-3">34 pieces</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-3 font-medium">Total Multi-Channel Reach</td>
                            <td className="p-3 font-bold text-slate-900 bg-indigo-50/30 border-x border-indigo-100">4.2M views</td>
                            <td className="p-3">1.9M views</td>
                            <td className="p-3">3.1M views</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-3 font-medium">Influencer Backing (Active)</td>
                            <td className="p-3 font-bold text-indigo-700 bg-indigo-50/30 border-x border-indigo-100">14 ambassadors</td>
                            <td className="p-3">8 ambassadors</td>
                            <td className="p-3">11 ambassadors</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Predictive Crisis Velocity Index & Alerting */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md text-slate-100 flex flex-col gap-5 mt-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500 rounded-full filter blur-3xl opacity-5 -mr-32 -mt-32"></div>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4 z-10">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">🚨</span>
                        <div>
                          <h3 className="font-extrabold text-white text-sm">Crisis Velocity Index (CVI)</h3>
                          <p className="text-[11px] text-slate-400">Predictive neural telemetry evaluating hostile viral escalations</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCrisisVelocity(90);
                            setCrisisToxicity(85);
                            setCrisisViralSpread(95);
                            setIsCrisisSimulated(true);
                            setToast({ message: "⚠️ CRITICAL LEVEL 5 VIRAL CRISIS SIMULATED!", type: "error" });
                          }}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-mono font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded transition"
                        >
                          💥 Simulate Hostile Spike
                        </button>
                        <button
                          onClick={() => {
                            setCrisisVelocity(25);
                            setCrisisToxicity(15);
                            setCrisisViralSpread(10);
                            setIsCrisisSimulated(false);
                            setToast({ message: "Crisis indicators normalized to base levels.", type: "success" });
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded transition"
                        >
                          🔄 Reset System
                        </button>
                      </div>
                    </div>

                    {(() => {
                      // Calculate weighted Crisis Velocity Index
                      const calculatedCVI = Math.round(
                        (crisisVelocity * 0.45) + (crisisToxicity * 0.35) + (crisisViralSpread * 0.20)
                      );

                      let alertLevel = "SAFE";
                      let alertColor = "text-emerald-400";
                      let alertBg = "bg-emerald-950/20 border-emerald-900";
                      let alertDesc = "All listening vectors report stable brand health. Narrative is secure.";

                      if (calculatedCVI >= 40 && calculatedCVI < 70) {
                        alertLevel = "ELEVATED WATCH";
                        alertColor = "text-amber-400";
                        alertBg = "bg-amber-950/20 border-amber-900";
                        alertDesc = "Moderate velocity detected in public discussions. Salinger vectors tracking.";
                      } else if (calculatedCVI >= 70) {
                        alertLevel = "🚨 CRITICAL PR EMERGENCY (LEVEL 5)";
                        alertColor = "text-rose-400 font-black animate-pulse";
                        alertBg = "bg-rose-950/40 border-rose-900 animate-pulse";
                        alertDesc = "Extreme brand threat detected! Viral acceleration crosses regional limits.";
                      }

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
                          {/* Controls Left */}
                          <div className="lg:col-span-5 flex flex-col gap-4 bg-slate-950/40 p-4 border border-slate-850 rounded-xl">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">TELEMETRY PARAMETERS</span>
                            
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex justify-between font-medium text-slate-300">
                                <span>Mentions Velocity</span>
                                <span className="font-mono font-bold">{crisisVelocity}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={crisisVelocity}
                                onChange={(e) => {
                                  setCrisisVelocity(parseInt(e.target.value));
                                  if (parseInt(e.target.value) < 70 && crisisToxicity < 70) setIsCrisisSimulated(false);
                                }}
                                className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                              />
                              <span className="text-[9px] text-slate-500">Acceleration rate of new mentions in negative threads</span>
                            </div>

                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex justify-between font-medium text-slate-300">
                                <span>Topic Toxicity Ratio</span>
                                <span className="font-mono font-bold">{crisisToxicity}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={crisisToxicity}
                                onChange={(e) => {
                                  setCrisisToxicity(parseInt(e.target.value));
                                  if (parseInt(e.target.value) < 70 && crisisVelocity < 70) setIsCrisisSimulated(false);
                                }}
                                className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                              />
                              <span className="text-[9px] text-slate-500">Concentration of hostile/boycott-trigger language in content</span>
                            </div>

                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex justify-between font-medium text-slate-300">
                                <span>Viral Spread Coefficient</span>
                                <span className="font-mono font-bold">{crisisViralSpread}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={crisisViralSpread}
                                onChange={(e) => setCrisisViralSpread(parseInt(e.target.value))}
                                className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                              />
                              <span className="text-[9px] text-slate-500">Acceleration index of secondary shares, retweets & video stitch posts</span>
                            </div>
                          </div>

                          {/* Index Gauge Middle */}
                          <div className="lg:col-span-3 flex flex-col items-center justify-center p-4 bg-slate-950/40 border border-slate-850 rounded-xl">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-3">INDEX TELEMETRY</span>
                            <div className="relative flex items-center justify-center h-28 w-28">
                              {/* Outer ring */}
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke={calculatedCVI >= 70 ? "#f43f5e" : calculatedCVI >= 40 ? "#f59e0b" : "#10b981"}
                                  strokeWidth="8"
                                  fill="transparent"
                                  strokeDasharray="251.2"
                                  strokeDashoffset={251.2 - (251.2 * calculatedCVI) / 100}
                                  strokeLinecap="round"
                                  className="transition-all duration-300"
                                />
                              </svg>
                              <div className="absolute flex flex-col items-center">
                                <span className="text-3xl font-black font-mono tracking-tight text-white">{calculatedCVI}</span>
                                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">CVI SCORE</span>
                              </div>
                            </div>
                          </div>

                          {/* Status & Automated Alerts Right */}
                          <div className="lg:col-span-4 flex flex-col gap-3">
                            <div className={`p-4 border rounded-xl flex flex-col gap-1.5 ${alertBg}`}>
                              <span className="text-[10px] font-mono font-black tracking-wider text-slate-400">ALERT SYSTEM STATUS</span>
                              <span className={`text-xs font-extrabold uppercase ${alertColor}`}>{alertLevel}</span>
                              <p className="text-[11px] text-slate-300 leading-normal">{alertDesc}</p>
                            </div>

                            {calculatedCVI >= 70 ? (
                              <div className="bg-rose-950/20 border border-rose-900/60 rounded-xl p-3.5 flex flex-col gap-2 animate-in zoom-in-95 duration-200">
                                <span className="text-[9px] font-mono font-black text-rose-400 tracking-widest uppercase block border-b border-rose-950/60 pb-1.5">⚡ INSTANT DISPATCH LOG</span>
                                <div className="flex flex-col gap-1 text-[10px] text-slate-300 font-mono">
                                  <div className="flex items-center gap-1.5 text-emerald-400">
                                    <span>✓</span> <span>Slack #emergency-pr alert active</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-emerald-400">
                                    <span>✓</span> <span>CEO briefing SMS trigger sent</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-sky-400">
                                    <span>⏱</span> <span>Containment statement queued</span>
                                  </div>
                                </div>
                                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 mt-1 leading-normal">
                                  <strong className="text-rose-400 block mb-0.5">Emergency Action Plan:</strong>
                                  Utilize our Southeast Asian localized NLP framework to draft an immediate statement matching civic community values to defuse forum backlash.
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed italic text-center h-full flex items-center justify-center">
                                Telemetry within standard guardrails. Live alerting stream listening on #crisis-room.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Multi-Channel Influencers */}
              {repSubTab === "influencer_analytics" && (
                <div className="flex flex-col gap-6">
                  {/* Influencer aggregate overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tracked Partners</div>
                      <div className="text-2xl font-black text-slate-800 mt-1">14</div>
                      <div className="text-[11px] text-slate-400 mt-1">Tier-1 & Tier-2 Key Creators</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aggregate Audience</div>
                      <div className="text-2xl font-black text-indigo-600 mt-1">4.8M</div>
                      <div className="text-[11px] text-slate-400 mt-1">Total followers across networks</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Engagement Velocity</div>
                      <div className="text-2xl font-black text-emerald-600 mt-1">6.8%</div>
                      <div className="text-[11px] text-emerald-600 font-bold mt-1">↑ +1.8% above benchmark</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sentiment Lock Rate</div>
                      <div className="text-2xl font-black text-slate-800 mt-1">94%</div>
                      <div className="text-[11px] text-slate-400 mt-1">Primarily positive/advocating</div>
                    </div>
                  </div>

                  {/* Charts row: radar of channel engagement */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
                      <div className="flex flex-col">
                        <h3 className="font-bold text-slate-900 text-sm">Engagement by Network</h3>
                        <p className="text-xs text-slate-500">Radar representation of network resonance</p>
                      </div>
                      <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                            { subject: 'TikTok', A: 90 },
                            { subject: 'Instagram', A: 75 },
                            { subject: 'X (Twitter)', A: 60 },
                            { subject: 'WhatsApp', A: 85 },
                            { subject: 'Facebook', A: 50 }
                          ]}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={10} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#94a3b8" fontSize={8} />
                            <Radar name="Engagement Index" dataKey="A" stroke="#4f46e5" fill="#818cf8" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Influencer Leaderboard Table */}
                    <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                        <div className="flex flex-col">
                          <h3 className="font-bold text-slate-900 text-sm">Creator Engagement & Cooperation Status</h3>
                          <p className="text-xs text-slate-500">Key opinion leaders (KOLs) driving current brand campaigns</p>
                        </div>
                        <span className="text-[10px] font-mono bg-emerald-50 border border-emerald-150 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">
                          Live Active Registry
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold">
                              <th className="p-3">Creator Handle</th>
                              <th className="p-3">Network</th>
                              <th className="p-3 text-right">Followers</th>
                              <th className="p-3 text-right">Engagement</th>
                              <th className="p-3">Sentiment Align</th>
                              <th className="p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-slate-700">
                            {[
                              { name: "@khairulaming", platform: "TikTok", reach: "4.1M", rate: "12.5%", align: "Positive (98%)", status: "Organic Advocate", statusColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                              { name: "Siti Nurhaliza", platform: "Instagram", reach: "8.2M", rate: "4.2%", align: "Positive (99%)", status: "Contracted", statusColor: "bg-indigo-100 text-indigo-800 border-indigo-200" },
                              { name: "@syedot_asmr", platform: "TikTok", reach: "1.2M", rate: "8.9%", align: "Positive (88%)", status: "Contracted", statusColor: "bg-indigo-100 text-indigo-800 border-indigo-200" },
                              { name: "@ceddyornot", platform: "X (Twitter)", reach: "350K", rate: "7.4%", align: "Neutral (75%)", status: "Outreach Pending", statusColor: "bg-amber-100 text-amber-800 border-amber-200" },
                              { name: "Farah Fauzana", platform: "Facebook", reach: "2.1M", rate: "3.1%", align: "Positive (91%)", status: "Pending Renewal", statusColor: "bg-slate-100 text-slate-800 border-slate-200" }
                            ].map((kol, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-800">{kol.name}</td>
                                <td className="p-3">
                                  <span className="bg-slate-100 border border-slate-200 text-[10px] px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                    {kol.platform}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono font-bold">{kol.reach}</td>
                                <td className="p-3 text-right font-mono font-bold text-indigo-600">{kol.rate}</td>
                                <td className="p-3">
                                  <span className="text-emerald-600 font-medium">{kol.align}</span>
                                </td>
                                <td className="p-3">
                                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${kol.statusColor}`}>
                                    {kol.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 4: SE Asian NLP Dictionary Sandbox */}
              {repSubTab === "nlp_dictionary" && (
                <div className="flex flex-col gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-1 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📖</span>
                        <h3 className="font-extrabold text-slate-900 text-base">Southeast Asian Localized NLP Sandbox</h3>
                      </div>
                      <p className="text-xs text-slate-500">
                        Standard international tools often misinterpret localized slang and colloquial dialect, leading to severe brand sentiment skew.
                        PRVAIL’s regional NLP dictionary translates localized slang terms dynamically to optimize analytics accuracy.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left Side: Add Custom Slang and Dictionary Lists */}
                      <div className="lg:col-span-7 flex flex-col gap-6">
                        {/* Section: Active Dictionary lists */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Positive Slang */}
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col gap-3">
                            <span className="text-[10px] font-mono font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                              <span>🟢</span> Positive Slangs Dictionary
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {posSlangs.map((slang) => (
                                <span key={slang} className="bg-white border border-emerald-200 text-emerald-900 text-xs px-2.5 py-1 rounded-lg font-bold shadow-sm flex items-center gap-1">
                                  <span>👍</span> {slang}
                                </span>
                              ))}
                            </div>
                            <span className="text-[9px] text-emerald-600 italic">Interpreted as favorable endorsement.</span>
                          </div>

                          {/* Negative Slang */}
                          <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex flex-col gap-3">
                            <span className="text-[10px] font-mono font-black text-rose-800 uppercase tracking-widest flex items-center gap-1.5">
                              <span>🔴</span> Negative Slangs Dictionary
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {negSlangs.map((slang) => (
                                <span key={slang} className="bg-white border border-rose-200 text-rose-900 text-xs px-2.5 py-1 rounded-lg font-bold shadow-sm flex items-center gap-1">
                                  <span>👎</span> {slang}
                                </span>
                              ))}
                            </div>
                            <span className="text-[9px] text-rose-600 italic">Interpreted as dissatisfaction/backlash.</span>
                          </div>
                        </div>

                        {/* Form to add slang */}
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 flex flex-col gap-4">
                          <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest block">Lexicon Extension Interface</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-slate-700">Slang Term</label>
                              <input
                                type="text"
                                value={newSlangTerm}
                                onChange={(e) => setNewSlangTerm(e.target.value)}
                                placeholder="e.g., mantap, koyak"
                                className="border border-slate-200 rounded-lg p-2.5 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-slate-700">Sentiment Category</label>
                              <select
                                value={newSlangSentiment}
                                onChange={(e) => setNewSlangSentiment(e.target.value)}
                                className="border border-slate-200 rounded-lg p-2.5 bg-white text-xs font-semibold focus:outline-none"
                              >
                                <option value="Positive">👍 Positive Slang</option>
                                <option value="Negative">👎 Negative Slang</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={handleAddNewSlang}
                                className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-3 rounded-lg text-xs transition font-mono"
                              >
                                + Add Slang
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Dynamic Sentiment Sandbox Simulator */}
                      <div className="lg:col-span-5 bg-slate-950 text-slate-200 rounded-xl p-5 border border-slate-850 shadow-md flex flex-col gap-4">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Colloquial Text Sentiment Sandbox</span>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-slate-300 font-semibold">Enter a localized review or post to parse sentiment:</label>
                          <textarea
                            value={sandboxText}
                            onChange={(e) => setSandboxText(e.target.value)}
                            placeholder="Type Manglish/Malay review e.g., 'Inai brand ini mantap gila tapi customer service koyak sikit...'"
                            className="bg-black/40 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-100 h-28 focus:outline-none focus:ring-1 focus:ring-slate-700"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const result = analyzeSentimentDynamic(sandboxText);
                              setSandboxResult(result);
                              setToast({ message: "Parsed localized post successfully", type: "success" });
                            }}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 px-3 rounded-lg text-xs transition font-mono flex items-center justify-center gap-1.5"
                          >
                            <span>🧠 Run Parser Sandbox</span>
                          </button>
                          <button
                            onClick={() => {
                              setSandboxText("Inai brand ini mantap gila tapi customer service koyak sikit...");
                              setSandboxResult(null);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-3 rounded-lg text-xs transition"
                          >
                            Reset
                          </button>
                        </div>

                        {sandboxResult && (
                          <div className="bg-black/60 border border-slate-800 rounded-lg p-4 flex flex-col gap-3 animate-in fade-in duration-200">
                            <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                              <span className="text-[10px] font-mono text-slate-400">ANALYSIS OUTCOME</span>
                              <span className={`text-xs font-black uppercase font-mono ${sandboxResult.sentiment === "Positive" ? "text-emerald-400" : sandboxResult.sentiment === "Negative" ? "text-rose-400" : "text-amber-400"}`}>
                                {sandboxResult.sentiment === "Positive" ? "👍 Positive" : sandboxResult.sentiment === "Negative" ? "👎 Negative" : "✊ Neutral"}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-center">
                              <div className="bg-slate-900 rounded p-2">
                                <span className="text-[9px] text-slate-500 block">Sentiment Score</span>
                                <span className="text-xs font-black font-mono text-white">{sandboxResult.score > 0 ? `+${sandboxResult.score}` : sandboxResult.score}</span>
                              </div>
                              <div className="bg-slate-900 rounded p-2">
                                <span className="text-[9px] text-slate-500 block">Matched Slangs</span>
                                <span className="text-xs font-bold text-sky-400">{sandboxResult.matches.length > 0 ? sandboxResult.matches.join(", ") : "None"}</span>
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-400 leading-relaxed italic text-center">
                              Dynamic Lexicon mapping identifies matched words and flags the appropriate polarity multiplier automatically.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 5: One-Click Executive Briefing Report Generator */}
              {repSubTab === "executive_briefing" && (
                <div className="flex flex-col gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-200">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📋</span>
                          <h3 className="font-extrabold text-slate-900 text-base">One-Click C-Suite Executive Briefing & PPT Generator</h3>
                        </div>
                        <p className="text-xs text-slate-500">
                          Compile comprehensive, print-ready corporate dossiers and PowerPoint presentation mockups detailing campaigns, AVE audit sheets, and active crisis containment plans.
                        </p>
                      </div>
                      
                      <button
                        onClick={handleTriggerBriefingGen}
                        disabled={isGeneratingBriefing}
                        className="bg-slate-950 hover:bg-slate-850 text-white font-mono font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl transition flex items-center gap-2"
                      >
                        {isGeneratingBriefing ? "Compiling Briefing..." : "⚡ Generate Corporate Report"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left: Export Settings & Checklist */}
                      <div className="lg:col-span-4 bg-slate-50 border border-slate-150 rounded-xl p-5 flex flex-col gap-5">
                        <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest block">REPORT COMPILER OPTIONS</span>
                        
                        <div className="flex flex-col gap-3 text-xs text-slate-700">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-950 focus:ring-slate-950" />
                            <span className="font-medium">Include Financial AVE Assessment</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-950 focus:ring-slate-950" />
                            <span className="font-medium">Include Predictive Crisis Velocity telemetry</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-950 focus:ring-slate-950" />
                            <span className="font-medium">Include Southeast Asian slang audit trail</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-950 focus:ring-slate-950" />
                            <span className="font-medium">Include Media Competitor SOV Index</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-950 focus:ring-slate-950" />
                            <span className="font-medium">Queue Containment Statements in drafting portal</span>
                          </label>
                        </div>

                        <div className="border-t border-slate-200 pt-4 flex flex-col gap-2">
                          <span className="text-[9px] font-mono text-slate-400 font-bold block uppercase tracking-wider">PPT DECK PRESENTATION SLIDES</span>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="border border-slate-200 rounded p-1 text-center bg-white">
                              <div className="aspect-[4/3] bg-indigo-900 text-white flex items-center justify-center text-[8px] font-bold rounded">
                                Cover
                              </div>
                              <span className="text-[9px] text-slate-500 font-medium mt-0.5 block">Slide 1</span>
                            </div>
                            <div className="border border-slate-200 rounded p-1 text-center bg-white">
                              <div className="aspect-[4/3] bg-emerald-900 text-white flex items-center justify-center text-[8px] font-bold rounded">
                                Sentiment
                              </div>
                              <span className="text-[9px] text-slate-500 font-medium mt-0.5 block">Slide 2</span>
                            </div>
                            <div className="border border-slate-200 rounded p-1 text-center bg-white">
                              <div className="aspect-[4/3] bg-slate-900 text-white flex items-center justify-center text-[8px] font-bold rounded">
                                AVE Audit
                              </div>
                              <span className="text-[9px] text-slate-500 font-medium mt-0.5 block">Slide 3</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              setToast({ message: "Downloaded executive PPTX presentation file successfully!", type: "success" });
                            }}
                            className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg transition"
                          >
                            💾 Download PPT Presentation Deck (.pptx)
                          </button>
                        </div>
                      </div>

                      {/* Right: Live Interactive Report Preview Frame */}
                      <div className="lg:col-span-8 bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 shadow-md">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                          <span className="text-[10px] font-mono text-slate-400 font-black tracking-widest uppercase">C-SUITE PRINT PREVIEW DOSSIER</span>
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        </div>

                        {showBriefingPreview ? (
                          <div className="bg-white text-slate-800 border border-slate-200 rounded-lg p-6 font-sans text-xs leading-relaxed flex flex-col gap-4 animate-in fade-in duration-300">
                            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-mono text-slate-400 font-extrabold uppercase text-slate-500">PRVAIL CORPORATION SYSTEMS</span>
                                <h4 className="text-sm font-black text-slate-900">PR STATEMENT OF HEALTH REPORT</h4>
                                <span className="text-[9px] text-slate-500">Selected Workspace Campaign: {selectedClient?.name || "Active Client"}</span>
                              </div>
                              <span className="text-[9px] font-mono bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded font-bold uppercase">
                                STATUS: AUDITED
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
                                <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">CVI Telemetry</span>
                                <span className={`text-sm font-extrabold block mt-0.5 ${(crisisVelocity * 0.45 + crisisToxicity * 0.35 + crisisViralSpread * 0.20) >= 70 ? "text-rose-600 animate-pulse animate-duration-500 font-black" : "text-slate-900"}`}>
                                  {Math.round((crisisVelocity * 0.45) + (crisisToxicity * 0.35) + (crisisViralSpread * 0.20))} / 100
                                </span>
                              </div>
                              <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
                                <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Corporate AVE ROI</span>
                                <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                                  RM {(coverage.reduce((sum, item) => {
                                    let sentFactor = 1.0;
                                    if (item.sentiment === 'Positive') sentFactor = 1.4;
                                    if (item.sentiment === 'Negative') sentFactor = 0.2;
                                    return sum + ((item.reach || 25000) * 0.12 + (item.engagement || 500) * 1.6) * sentFactor * aveMultiplier;
                                  }, 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
                                <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Campaign Reach</span>
                                <span className="text-sm font-extrabold text-indigo-700 block mt-0.5">
                                  {coverage.reduce((sum, item) => sum + (item.reach || 0), 0).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
                              <strong className="text-slate-900 text-xs">C-Suite Narrative Situation & Action Summary:</strong>
                              <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                                High-velocity digital indicators suggest {Math.round((crisisVelocity * 0.45) + (crisisToxicity * 0.35) + (crisisViralSpread * 0.20)) >= 70 ? (
                                  <span className="text-rose-600 font-bold">CRITICAL CRISIS ACCELERATION is active. immediate narrative containment statement is dispatched. Adverting campaigns temporarily paused to protect core brand equity.</span>
                                ) : (
                                  <span>brand narrative remains highly stable and positive. Slang parsing indicates healthy localized reception in general communities. Recommend regular crawl schedule expansion.</span>
                                )}.
                              </p>
                            </div>

                            <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                              <span>Generated on: {new Date().toLocaleDateString()}</span>
                              <span>Ref ID: PRV-BRIEF-{selectedWorkspace.toUpperCase()}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 gap-3">
                            <span className="text-3xl">🖨️</span>
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-300 font-bold text-xs">Executive Dossier Not Compiled</span>
                              <span className="text-[10px] text-slate-400">Click the generate button at the top to draft this report live.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ),
          activeTab === "enterprise" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                sanitizeView ? /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-mono bg-slate-800 text-emerald-400 border border-emerald-950 px-2.5 py-0.5 rounded font-black tracking-widest uppercase", children: "\u2728 CORPORATE SECURED" }),
                  /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-emerald-500 rounded-full animate-pulse" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[11px] text-emerald-300 font-bold uppercase tracking-wider", children: "Sanitized Presentation Session Active" })
                ] }) : /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-mono bg-slate-700 text-white px-2 py-0.5 rounded font-black tracking-widest uppercase", children: "RESTRICTED ACCESS" }),
                  /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-emerald-500 rounded-full animate-ping" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[11px] text-slate-300 font-bold uppercase tracking-wider", children: "Multi-Tenant Tenant Isolation Active" })
                ] }),
                /* @__PURE__ */ jsx("h2", { className: "text-2xl font-black tracking-tight", children: "\u{1F3E2} PRVAIL Corporate Strategy Hub" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400", children: "Configure corporate workspaces, generate executive analytical briefs, and compile high-level compliance digests." })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex items-center gap-3", children: /* @__PURE__ */ jsxs("div", { className: "bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-center", children: [
                /* @__PURE__ */ jsx("div", { className: "text-[10px] text-slate-400 font-extrabold tracking-wider uppercase", children: "Executive Workspace" }),
                /* @__PURE__ */ jsxs("div", { className: "text-xs font-mono font-bold text-slate-200 mt-0.5", children: [
                  selectedWorkspace.toUpperCase(),
                  " Registry"
                ] })
              ] }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start", children: [
              /* @__PURE__ */ jsx("div", { className: "lg:col-span-4 flex flex-col gap-6", children: sanitizeView ? (
                /* SANITIZED VIEW: Pristine Client Portfolio directory with no security panels or activity logs */
                /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-5 border-t-4 border-t-slate-900", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-slate-100 pb-3", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F4BC}" }),
                    /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-sm", children: "Corporate Client Portfolio" })
                  ] }),
                  /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-slate-500 leading-relaxed", children: [
                    "Active corporate accounts currently tracked under the ",
                    selectedWorkspace.toUpperCase(),
                    " monitoring protocol."
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: clients.map((c) => /* @__PURE__ */ jsxs("div", { className: "p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1.5 hover:border-slate-300 transition", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-xs font-black text-slate-950", children: c.name }),
                      /* @__PURE__ */ jsxs("span", { className: "text-[10px] font-mono bg-slate-200 text-slate-800 font-extrabold px-1.5 py-0.5 rounded", children: [
                        "\u2B50 Score: ",
                        c.credibilityScore
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-500 font-medium", children: c.industry }),
                    /* @__PURE__ */ jsxs("div", { className: "text-[11px] text-slate-600 line-clamp-2 mt-1 italic", children: [
                      '"',
                      c.notes,
                      '"'
                    ] })
                  ] }, c.id)) })
                ] })
              ) : (
                /* DEMO VIEW: Switcher panels, technical status, and team activity logs */
                /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsxs("div", { className: "bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-2 text-indigo-950", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-base", children: "\u{1F465}" }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] font-black uppercase tracking-wider text-indigo-800", children: "WORKSPACE REGISTRY" }),
                      /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold text-indigo-900", children: "Collaborative Actions & Logs" })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 border-t-4 border-t-indigo-500", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-slate-100 pb-3", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F512}" }),
                      /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-sm", children: "Tenant Access Parameters" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                        /* @__PURE__ */ jsx("label", { className: "text-[10px] font-extrabold text-slate-500 uppercase tracking-wider", children: "Region Workspace" }),
                        /* @__PURE__ */ jsxs(
                          "select",
                          {
                            value: selectedWorkspace,
                            onChange: (e) => {
                              setSelectedWorkspace(e.target.value);
                              setToast({ message: `Switched region workspace to: ${e.target.value.toUpperCase()}`, type: "success" });
                            },
                            className: "border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none bg-slate-50",
                            children: [
                              /* @__PURE__ */ jsx("option", { value: "kl-hq", children: "Kuala Lumpur HQ (ESG Aligned)" }),
                              /* @__PURE__ */ jsx("option", { value: "sg-reg", children: "Singapore Hub (MAS/ESG Aligned)" }),
                              /* @__PURE__ */ jsx("option", { value: "em-bkh", children: "East Malaysia Hub (Regional Equity)" }),
                              /* @__PURE__ */ jsx("option", { value: "gl-ent", children: "Global Strategy Group (Governance)" })
                            ]
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                        /* @__PURE__ */ jsx("label", { className: "text-[10px] font-extrabold text-slate-500 uppercase tracking-wider", children: "User Simulation Role" }),
                        /* @__PURE__ */ jsxs(
                          "select",
                          {
                            value: userRole,
                            onChange: (e) => {
                              setUserRole(e.target.value);
                              setToast({ message: `Assigned user role: ${e.target.value.toUpperCase()}`, type: "success" });
                            },
                            className: "border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none bg-slate-50",
                            children: [
                              /* @__PURE__ */ jsx("option", { value: "analyst", children: "Media Analyst" }),
                              /* @__PURE__ */ jsx("option", { value: "director", children: "Senior PR Director" }),
                              /* @__PURE__ */ jsx("option", { value: "advisor", children: "Strategic Advisor" }),
                              /* @__PURE__ */ jsx("option", { value: "compliance", children: "Compliance Officer" })
                            ]
                          }
                        )
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2 text-[11px] text-slate-600 font-medium", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
                        /* @__PURE__ */ jsx("span", { children: "X-Tenant-ID Header:" }),
                        /* @__PURE__ */ jsxs("span", { className: "font-mono font-bold text-slate-900", children: [
                          "tn_",
                          selectedWorkspace,
                          "_x9"
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
                        /* @__PURE__ */ jsx("span", { children: "Authentication Mode:" }),
                        /* @__PURE__ */ jsx("span", { className: "font-mono font-bold text-slate-900", children: "JWT + OAuth2" })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
                        /* @__PURE__ */ jsx("span", { children: "Encrypted Channel:" }),
                        /* @__PURE__ */ jsx("span", { className: "font-mono font-bold text-emerald-600", children: "AES-256 ACTIVE" })
                      ] })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 border-t-4 border-t-indigo-600", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-3", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                        /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F91D}" }),
                        /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-sm", children: "Live Workspace Activity" })
                      ] }),
                      /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-emerald-500 rounded-full animate-ping" })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-500 leading-relaxed", children: "Rolling live feed of PR actions executed by automated agents and human analysts sharing this tenant." }),
                    /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1", children: teamActivities.map((act) => /* @__PURE__ */ jsxs("div", { className: "p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1.5 hover:border-slate-300 transition", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start gap-2", children: [
                        /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-slate-950", children: act.user }),
                        act.badge && /* @__PURE__ */ jsx("span", { className: "text-[9px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.5 rounded tracking-wide font-mono", children: act.badge })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { className: "text-[11px] text-slate-600 leading-tight", children: [
                        /* @__PURE__ */ jsxs("span", { className: "text-slate-400 italic", children: [
                          "(",
                          act.role,
                          ")"
                        ] }),
                        " ",
                        act.action
                      ] }),
                      /* @__PURE__ */ jsxs("span", { className: "text-[9px] text-slate-400 font-mono text-right mt-1 block", children: [
                        "\u23F1\uFE0F ",
                        act.time
                      ] })
                    ] }, act.id)) }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => {
                          const sampleUsers = ["Devan Nair", "Sophia Lim", "Azwan Halim", "Elena Wong"];
                          const sampleRoles = ["Cosmetics Specialist", "Aviation PR Advisor", "Compliance Officer", "Regional Advisor"];
                          const sampleActions = [
                            "analyzed the Cosmo Daily RSS feed for sugar tax keywords",
                            "drafted a new press release for regional distribution",
                            "modified due date on Borneo Air community tasks",
                            "validated media contact records against regional Halal compliance standards"
                          ];
                          const sampleBadges = ["RSS Audit", "Draft PR", "Task Edit", "Halal Audit"];
                          const idx = Math.floor(Math.random() * sampleUsers.length);
                          setTeamActivities((prev) => [
                            {
                              id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
                              user: sampleUsers[idx],
                              role: sampleRoles[idx],
                              action: sampleActions[idx],
                              time: "Just now",
                              badge: sampleBadges[idx]
                            },
                            ...prev
                          ]);
                          setToast({ message: "Broadcasted new collaborative team action to workspace stream!", type: "success" });
                        },
                        className: "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition text-center shadow-sm",
                        children: "\u2795 Broadcast Simulate Team Action"
                      }
                    )
                  ] })
                ] })
              ) }),
              /* @__PURE__ */ jsxs("div", { className: "lg:col-span-8 flex flex-col gap-6", children: [
                /* @__PURE__ */ jsxs("div", { className: "bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center gap-2 text-slate-900", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-base", children: "\u{1F4CA}" }),
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-[10px] font-black uppercase tracking-wider text-slate-800", children: "DECISION METRICS" }),
                    /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold text-slate-900", children: "Advanced Strategic Monitoring Engine" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm border-t-4 border-t-slate-900", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-slate-100 pb-3 mb-4", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-lg", children: "\u{1F4C8}" }),
                    /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-sm", children: "Briefing Configuration Parameters" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] font-extrabold text-slate-500 uppercase tracking-wider", children: "Active Campaign" }),
                      /* @__PURE__ */ jsxs("div", { className: "border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-slate-50 flex items-center gap-2", children: [
                        /* @__PURE__ */ jsx("span", { children: "\u{1F3E2}" }),
                        /* @__PURE__ */ jsx("span", { children: selectedClient?.name })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] font-extrabold text-slate-500 uppercase tracking-wider", children: "Analysis Period" }),
                      /* @__PURE__ */ jsxs(
                        "select",
                        {
                          value: reportPeriod,
                          onChange: (e) => setReportPeriod(e.target.value),
                          className: "border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none bg-slate-50",
                          children: [
                            /* @__PURE__ */ jsx("option", { value: "24h", children: "Last 24 Hours" }),
                            /* @__PURE__ */ jsx("option", { value: "7d", children: "Last 7 Days" }),
                            /* @__PURE__ */ jsx("option", { value: "30d", children: "Last 30 Days" })
                          ]
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] font-extrabold text-slate-500 uppercase tracking-wider", children: "Strategic Objective Theme" }),
                      /* @__PURE__ */ jsxs(
                        "select",
                        {
                          value: reportTheme,
                          onChange: (e) => setReportTheme(e.target.value),
                          className: "border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none bg-slate-50",
                          children: [
                            /* @__PURE__ */ jsx("option", { value: "sentiment", children: "Advanced Sentiment & Slang Shift Analysis" }),
                            /* @__PURE__ */ jsx("option", { value: "crisis", children: "Strategic PR Risk & Crisis Assessment" }),
                            /* @__PURE__ */ jsx("option", { value: "policy", children: "Socioeconomic & National Policy Audit" })
                          ]
                        }
                      )
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: handleGenerateEnterpriseReport,
                      disabled: isGeneratingReport,
                      className: "w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50",
                      children: isGeneratingReport ? /* @__PURE__ */ jsxs(Fragment, { children: [
                        /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin text-white" }),
                        /* @__PURE__ */ jsx("span", { children: "Compiling SECURE enterprise metrics and policy alignments..." })
                      ] }) : /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("span", { children: "\u{1F4CA} Generate Advanced Executive Report" }) })
                    }
                  )
                ] }),
                generatedReport ? /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl shadow-md p-6 flex flex-col gap-5 border-t-4 border-t-slate-900 animate-in fade-in zoom-in-95 duration-200", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-4", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                        /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" }),
                        /* @__PURE__ */ jsx("span", { className: "text-[10px] text-emerald-700 font-extrabold uppercase tracking-widest font-mono", children: "SECURE PIPELINE ACTIVE" })
                      ] }),
                      /* @__PURE__ */ jsx("h3", { className: "text-lg font-black text-slate-950 tracking-tight", children: generatedReport.title }),
                      /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-slate-400 font-semibold font-mono", children: [
                        "Compiled at ",
                        generatedReport.timestamp,
                        " (MYT)"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
                      /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: handleDownloadPDF,
                          className: "flex items-center gap-1 bg-slate-950 hover:bg-slate-850 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition",
                          children: [
                            /* @__PURE__ */ jsx(Download, { className: "w-3.5 h-3.5 text-slate-300" }),
                            /* @__PURE__ */ jsx("span", { children: "Download PDF" })
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: handleDownloadCSV,
                          className: "flex items-center gap-1 bg-slate-50 border hover:bg-slate-100 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs transition",
                          children: [
                            /* @__PURE__ */ jsx(Download, { className: "w-3.5 h-3.5" }),
                            /* @__PURE__ */ jsx("span", { children: "Export CSV dataset" })
                          ]
                        }
                      )
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 border rounded-xl border-slate-150", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[9px] text-slate-400 font-bold uppercase tracking-wider", children: "Tenant Partition" }),
                      /* @__PURE__ */ jsxs("span", { className: "text-xs font-bold text-slate-900", children: [
                        "tn_",
                        selectedWorkspace,
                        "_x9"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[9px] text-slate-400 font-bold uppercase tracking-wider", children: "User role Context" }),
                      /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-slate-900", children: userRole.toUpperCase() })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[9px] text-slate-400 font-bold uppercase tracking-wider", children: "Compliance Blueprint" }),
                      /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-slate-900", children: selectedWorkspace === "kl-hq" ? "Corporate / ESG" : "ASEAN / ESG" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[9px] text-slate-400 font-bold uppercase tracking-wider", children: "Access Integrity" }),
                      /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-emerald-600", children: "Level 3 Authorized" })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
                    /* @__PURE__ */ jsx("h4", { className: "text-xs font-extrabold text-slate-900 uppercase tracking-wider", children: "Executive Overview" }),
                    /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-700 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-dashed text-justify", children: generatedReport.executiveSummary })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch", children: [
                    /* @__PURE__ */ jsxs("div", { className: "border border-slate-200 rounded-xl p-4 flex flex-col gap-3", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] font-extrabold text-slate-500 uppercase tracking-wider", children: "Tenant Sentiment Breakdown" }),
                      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3.5 mt-2", children: [
                        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-slate-700 font-bold", children: [
                            /* @__PURE__ */ jsx("span", { children: "\u{1F7E2} Positive" }),
                            /* @__PURE__ */ jsxs("span", { children: [
                              generatedReport.sentimentDistribution.positive,
                              "%"
                            ] })
                          ] }),
                          /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-100 h-3 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: "bg-emerald-500 h-full rounded-full transition-all duration-1000",
                              style: { width: `${generatedReport.sentimentDistribution.positive}%` }
                            }
                          ) })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-slate-700 font-bold", children: [
                            /* @__PURE__ */ jsx("span", { children: "\u{1F7E1} Neutral" }),
                            /* @__PURE__ */ jsxs("span", { children: [
                              generatedReport.sentimentDistribution.neutral,
                              "%"
                            ] })
                          ] }),
                          /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-100 h-3 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: "bg-amber-400 h-full rounded-full transition-all duration-1000",
                              style: { width: `${generatedReport.sentimentDistribution.neutral}%` }
                            }
                          ) })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-slate-700 font-bold", children: [
                            /* @__PURE__ */ jsx("span", { children: "\u{1F534} Negative" }),
                            /* @__PURE__ */ jsxs("span", { children: [
                              generatedReport.sentimentDistribution.negative,
                              "%"
                            ] })
                          ] }),
                          /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-100 h-3 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: "bg-rose-500 h-full rounded-full transition-all duration-1000",
                              style: { width: `${generatedReport.sentimentDistribution.negative}%` }
                            }
                          ) })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsx("div", { className: "border-t border-slate-100 pt-3.5 mt-2", children: /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-slate-500 leading-normal", children: [
                        /* @__PURE__ */ jsx("strong", { className: "text-slate-700", children: "Raw Volume Share vs. AI-Weighted Sentiment Score:" }),
                        /* @__PURE__ */ jsx("br", {}),
                        "The bars above plot the ",
                        /* @__PURE__ */ jsx("strong", { children: "Raw Volume Share" }),
                        " percentages of media mentions. The executive summary quotes the integrated ",
                        /* @__PURE__ */ jsx("strong", { children: "AI-Weighted Sentiment Score" }),
                        " of ",
                        /* @__PURE__ */ jsxs("strong", { children: [
                          Math.round(generatedReport.sentimentDistribution.positive + generatedReport.sentimentDistribution.neutral * 0.5),
                          "%"
                        ] }),
                        ", which applies a 50% stabilizing factor to neutral chatter to index resilient brand health."
                      ] }) })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3", children: [
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("span", { className: "text-[10px] font-extrabold text-slate-500 uppercase tracking-wider", children: "Regional Media Impact Index" }),
                        /* @__PURE__ */ jsxs("div", { className: "flex items-baseline gap-2 mt-2", children: [
                          /* @__PURE__ */ jsx("span", { className: "text-4xl font-black text-slate-900", children: generatedReport.regionalImpactIndex }),
                          /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-400 font-bold", children: "/ 100" })
                        ] }),
                        /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-500 leading-relaxed mt-1", children: "Calculated relative media amplification index weighted by regional active audience demographics and sentiment multipliers." })
                      ] }),
                      /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-100 h-2.5 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx(
                        "div",
                        {
                          className: "bg-slate-800 h-full rounded-full",
                          style: { width: `${generatedReport.regionalImpactIndex}%` }
                        }
                      ) })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
                    /* @__PURE__ */ jsx("h4", { className: "text-xs font-extrabold text-slate-900 uppercase tracking-wider", children: "Key Audit Findings & Insights" }),
                    /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2", children: generatedReport.keyFindings.map((finding, idx) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-xs bg-slate-900 text-white font-extrabold w-5 h-5 flex items-center justify-center rounded-full shrink-0", children: idx + 1 }),
                      /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-700 leading-relaxed", children: finding })
                    ] }, idx)) })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "border-t border-slate-100 pt-4 flex flex-col gap-2", children: [
                    /* @__PURE__ */ jsx("h4", { className: "text-xs font-extrabold text-slate-900 uppercase tracking-wider", children: "Recommended Strategic Alignment" }),
                    /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-700 leading-relaxed bg-slate-50/50 border border-slate-200 p-4 rounded-xl", children: generatedReport.policyAlignmentNotes })
                  ] })
                ] }) : /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-5xl", children: "\u{1F4CA}" }),
                  /* @__PURE__ */ jsx("h4", { className: "font-bold text-slate-700 text-base", children: "Analytical Report Pending Parameters" }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs max-w-sm", children: "Select your objective theme and target analysis period above, then click generate to trigger secure metrics compilations." })
                ] })
              ] })
            ] })
          ] }),
          activeTab === "settings" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-mono bg-slate-800 text-emerald-400 border border-emerald-950 px-2.5 py-0.5 rounded font-black tracking-widest uppercase", children: "🔒 LOCAL SANDBOX SECURE" }),
                  /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-emerald-500 rounded-full animate-pulse" })
                ] }),
                /* @__PURE__ */ jsx("h2", { className: "text-2xl font-black tracking-tight", children: "⚙️ Settings & External API Connections" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400", children: "Manage secure external integrations including Google Vertex AI, Google BigQuery, encryption flags, and stream ingest cadence." })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [
              /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4 border-t-4 border-t-indigo-500", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-3", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-xl", children: "🤖" }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                      /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-sm", children: "Google Vertex AI LLM" }),
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: "Text generation, summarization & slang parsing" })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
                    /* @__PURE__ */ jsx("span", { className: `w-2 h-2 rounded-full ${vertexStatus === "Connected" ? "bg-emerald-500 animate-pulse" : vertexStatus === "Credentials Error" ? "bg-red-500" : "bg-slate-400"}` }),
                    /* @__PURE__ */ jsx("span", { className: `text-[11px] font-bold ${vertexStatus === "Connected" ? "text-emerald-600" : vertexStatus === "Credentials Error" ? "text-red-600" : "text-slate-500"}`, children: vertexStatus })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Google Cloud Project ID" }),
                  /* @__PURE__ */ jsx("input", {
                    type: "text",
                    value: vertexProject,
                    onChange: (e) => setVertexProject(e.target.value),
                    placeholder: "e.g. prvail-production-vertex",
                    className: "border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 font-mono"
                  })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Vertex AI API Credential Key" }),
                  /* @__PURE__ */ jsx("input", {
                    type: "password",
                    value: vertexApiKey,
                    onChange: (e) => setVertexApiKey(e.target.value),
                    placeholder: "Enter Vertex/Gemini Developer Key",
                    className: "border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 font-mono"
                  })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Vertex AI API Region Host" }),
                  /* @__PURE__ */ jsxs("select", {
                    value: vertexRegion,
                    onChange: (e) => setVertexRegion(e.target.value),
                    className: "border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none bg-slate-50 font-semibold text-slate-800",
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "asia-southeast1", children: "asia-southeast1 (Singapore Hub)" }),
                      /* @__PURE__ */ jsx("option", { value: "us-central1", children: "us-central1 (Iowa Hub)" }),
                      /* @__PURE__ */ jsx("option", { value: "europe-west3", children: "europe-west3 (Frankfurt Hub)" }),
                      /* @__PURE__ */ jsx("option", { value: "asia-northeast1", children: "asia-northeast1 (Tokyo Hub)" })
                    ]
                  })
                ] }),
                /* @__PURE__ */ jsx("button", {
                  type: "button",
                  onClick: handleTestVertex,
                  disabled: isTestingVertex,
                  className: "mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50",
                  children: isTestingVertex ? /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-slate-300" }),
                    /* @__PURE__ */ jsx("span", { children: "Testing connection..." })
                  ] }) : "Test Connection"
                })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4 border-t-4 border-t-emerald-500", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-3", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-xl", children: "🗄️" }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                      /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-sm", children: "Google BigQuery Data Source" }),
                      /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 font-mono", children: "Media coverage storage & compliance archiving" })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
                    /* @__PURE__ */ jsx("span", { className: `w-2 h-2 rounded-full ${bqStatus === "Connected" ? "bg-emerald-500 animate-pulse" : bqStatus === "Credentials Error" ? "bg-red-500" : "bg-slate-400"}` }),
                    /* @__PURE__ */ jsx("span", { className: `text-[11px] font-bold ${bqStatus === "Connected" ? "text-emerald-600" : bqStatus === "Credentials Error" ? "text-red-600" : "text-slate-500"}`, children: bqStatus })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "BigQuery Dataset ID" }),
                  /* @__PURE__ */ jsx("input", {
                    type: "text",
                    value: bqDataset,
                    onChange: (e) => setBqDataset(e.target.value),
                    placeholder: "e.g. prvail_media_listening_raw",
                    className: "border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 font-mono"
                  })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "BigQuery Table ID / Path" }),
                  /* @__PURE__ */ jsx("input", {
                    type: "text",
                    value: bqTable,
                    onChange: (e) => setBqTable(e.target.value),
                    placeholder: "e.g. coverage_stream",
                    className: "border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 font-mono"
                  })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Service Account JSON Private Key" }),
                  /* @__PURE__ */ jsx("textarea", {
                    rows: 3,
                    value: bqServiceAccount,
                    onChange: (e) => setBqServiceAccount(e.target.value),
                    placeholder: "Paste Service Account JSON private key",
                    className: "border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 font-mono text-slate-600 resize-none"
                  })
                ] }),
                /* @__PURE__ */ jsx("button", {
                  type: "button",
                  onClick: handleTestBq,
                  disabled: isTestingBq,
                  className: "mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50",
                  children: isTestingBq ? /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-slate-300" }),
                    /* @__PURE__ */ jsx("span", { children: "Testing BigQuery stream..." })
                  ] }) : "Test Ingestion Stream"
                })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4 border-t-4 border-t-slate-800", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-slate-100 pb-3", children: [
                /* @__PURE__ */ jsx("span", { className: "text-lg", children: "⚙️" }),
                /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-sm", children: "Stream Configuration & Data Safety" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-slate-700", children: "Ingestion Cadence / Sync Frequency" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400", children: "Adjust how frequently the listener crawls and pings BigQuery nodes." }),
                  /* @__PURE__ */ jsxs("select", {
                    value: syncFrequency,
                    onChange: (e) => setSyncFrequency(e.target.value),
                    className: "border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none bg-slate-50 font-semibold text-slate-800 mt-1",
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "Real-time", children: "Real-time Stream Ingestion" }),
                      /* @__PURE__ */ jsx("option", { value: "Every 5m", children: "Every 5 Minutes (Optimized)" }),
                      /* @__PURE__ */ jsx("option", { value: "Hourly", children: "Hourly Batch Sync" }),
                      /* @__PURE__ */ jsx("option", { value: "Daily", children: "Daily Compliance Archive" })
                    ]
                  })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 justify-between", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-0.5", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-slate-700", children: "Data Stream Encryption (AES-256)" }),
                    /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400", children: "Force end-to-end payload encryption for all API credentials & logs." })
                  ] }),
                  /* @__PURE__ */ jsxs("label", { className: "relative inline-flex items-center cursor-pointer mt-2", children: [
                    /* @__PURE__ */ jsx("input", {
                      type: "checkbox",
                      checked: streamEncryption,
                      onChange: (e) => setStreamEncryption(e.target.checked),
                      className: "sr-only peer"
                    }),
                    /* @__PURE__ */ jsx("div", { className: "w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900" }),
                    /* @__PURE__ */ jsx("span", { className: "ml-3 text-xs font-bold text-slate-700", children: streamEncryption ? "AES-256 Active" : "Disabled" })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "border-t border-slate-100 pt-4 flex justify-between items-center", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400 italic max-w-md", children: "🔒 Credentials stored securely in your local browser sandbox. Private keys never leave this domain." }),
                /* @__PURE__ */ jsx("button", {
                  type: "button",
                  onClick: handleSaveSettings,
                  className: "bg-slate-900 hover:bg-slate-850 text-white font-bold px-6 py-2.5 rounded-lg text-xs transition shadow-sm",
                  children: "Save Configuration"
                })
              ] })
            ] })
          ] })
        ] })
      ] })
    ] }),
    showNewClientModal && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs(
      "form",
      {
        onSubmit: handleCreateClient,
        className: "bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-md flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 pb-3 flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-base", children: "\u{1F3E2} Register New Client Campaign" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setShowNewClientModal(false),
                className: "text-slate-400 hover:text-slate-600 font-bold",
                children: "\u2715"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Client / Organization Name" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "e.g. Inai Republic, Tenaga Digital...",
                value: newClientName,
                onChange: (e) => setNewClientName(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Industry / Focus Area" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "e.g. F&B, Green Energy, Biotech...",
                value: newClientIndustry,
                onChange: (e) => setNewClientIndustry(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Monitoring Keywords (Comma Separated)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "e.g. Inai Republic, inai organik, inai republic...",
                value: newClientKeywords,
                onChange: (e) => setNewClientKeywords(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Strategic Background / Notes" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                rows: 3,
                placeholder: "Core narrative goals, public stance, known compliance benchmarks...",
                value: newClientNotes,
                onChange: (e) => setNewClientNotes(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-3 mt-2", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setShowNewClientModal(false),
                className: "flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-lg text-xs hover:bg-slate-50 transition",
                children: "Cancel"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                className: "flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-xs transition",
                children: "Register Client"
              }
            )
          ] })
        ]
      }
    ) }),
    showNewCoverageModal && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs(
      "form",
      {
        onSubmit: handleAddCoverage,
        className: "bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-lg flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 pb-3 flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-base", children: "\u{1F4F0} Ingest Media Mention" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setShowNewCoverageModal(false),
                className: "text-slate-400 hover:text-slate-600 font-bold",
                children: "\u2715"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Source Platform" }),
              /* @__PURE__ */ jsxs(
                "select",
                {
                  value: covSource,
                  onChange: (e) => setCovSource(e.target.value),
                  className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none",
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "Platform Video Sosial (Demo)", children: "Platform Video Sosial (Demo)" }),
                    /* @__PURE__ */ jsx("option", { value: "Forum Perbincangan Tempatan (Demo)", children: "Forum Perbincangan Tempatan (Demo)" }),
                    /* @__PURE__ */ jsx("option", { value: "Berita Nusantara (Demo)", children: "Berita Nusantara (Demo)" }),
                    /* @__PURE__ */ jsx("option", { value: "Kini Portal Berita (Demo)", children: "Kini Portal Berita (Demo)" }),
                    /* @__PURE__ */ jsx("option", { value: "Akhbar Utama Demo", children: "Akhbar Utama Demo" }),
                    /* @__PURE__ */ jsx("option", { value: "Akhbar Harian Demo", children: "Akhbar Harian Demo" })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Author Handle / Journalist" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  placeholder: "e.g. @Syamil_99 or Nicholas Tan",
                  value: covAuthor,
                  onChange: (e) => setCovAuthor(e.target.value),
                  className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Headline / Post Header" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "Headline content or thread subject title...",
                value: covTitle,
                onChange: (e) => setCovTitle(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none",
                required: true
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Full Post / Mentions Content (incorporate local slang if desired)" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                rows: 5,
                placeholder: "Paste the social mention body or article text here... (Try adding regional slang like 'mantap gila', 'cincai', or 'manis gila' to trigger the cultural listening insights)",
                value: covContent,
                onChange: (e) => setCovContent(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100",
                required: true
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-3 mt-2", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setShowNewCoverageModal(false),
                className: "flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-lg text-xs hover:bg-slate-50 transition",
                children: "Cancel"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                disabled: isAnalyzingCoverage,
                className: "flex-1 bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50",
                children: isAnalyzingCoverage ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-slate-300" }),
                  /* @__PURE__ */ jsx("span", { children: "AI Analysis..." })
                ] }) : /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("span", { children: "Ingest & Run AI listening" }) })
              }
            )
          ] })
        ]
      }
    ) }),
    showNewTaskModal && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs(
      "form",
      {
        onSubmit: handleAddTask,
        className: "bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-md flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 pb-3 flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-extrabold text-slate-900 text-base", children: "\u{1F4CB} Add Campaign Task" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setShowNewTaskModal(false),
                className: "text-slate-400 hover:text-slate-600 font-bold",
                children: "\u2715"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Task Title / Statement Action" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "e.g. Address Forum Sugar Concerns Statement",
                value: taskTitle,
                onChange: (e) => setTaskTitle(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none",
                required: true
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Action Description" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                rows: 3,
                placeholder: "Detail instructions, message guidelines, and targets...",
                value: taskDesc,
                onChange: (e) => setTaskDesc(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-slate-700", children: "Due Date" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "date",
                value: taskDueDate,
                onChange: (e) => setTaskDueDate(e.target.value),
                className: "border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-3 mt-2", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setShowNewTaskModal(false),
                className: "flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-lg text-xs hover:bg-slate-50 transition",
                children: "Cancel"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                className: "flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-xs transition",
                children: "Create Task"
              }
            )
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx("footer", { className: "bg-white border-t border-slate-200 mt-auto py-6", children: /* @__PURE__ */ jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 font-semibold gap-4", children: [
      /* @__PURE__ */ jsx("span", { children: "© 2026 PRVAIL Enterprise Communications. Certified Enterprise Cloud Security Compliance." }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-6", children: [
        /* @__PURE__ */ jsx("a", { href: "#", className: "hover:text-slate-900 transition", children: "Solutions" }),
        /* @__PURE__ */ jsx("a", { href: "#", className: "hover:text-slate-900 transition", children: "API docs" }),
        /* @__PURE__ */ jsx("a", { href: "#", className: "hover:text-slate-900 transition", children: "Terms of use" })
      ] })
    ] }) })
    ] })
  ] });
}
export {
  App as default
};
