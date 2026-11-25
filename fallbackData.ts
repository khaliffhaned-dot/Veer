/**
 * Fallback Malaysian intelligence dataset generator for NusaPulse and other modules
 * when backend AI APIs are unreachable or direct keys lack quota/permissions.
 */

export function getFallbackMarketIntelligence(clientName: string, industry: string) {
    const states = [
        { region: 'Selangor', lat: 3.0738, lng: 101.5183, positive: 58, neutral: 27, negative: 15, buzz: 88 },
        { region: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869, positive: 62, neutral: 23, negative: 15, buzz: 95 },
        { region: 'Johor', lat: 1.4854, lng: 103.7618, positive: 54, neutral: 31, negative: 15, buzz: 76 },
        { region: 'Penang', lat: 5.4164, lng: 100.3327, positive: 65, neutral: 22, negative: 13, buzz: 82 },
        { region: 'Perak', lat: 4.5921, lng: 101.0901, positive: 49, neutral: 36, negative: 15, buzz: 61 },
        { region: 'Kedah', lat: 6.1184, lng: 100.3685, positive: 45, neutral: 38, negative: 17, buzz: 58 },
        { region: 'Pahang', lat: 3.8126, lng: 103.3256, positive: 52, neutral: 33, negative: 15, buzz: 52 },
        { region: 'Negeri Sembilan', lat: 2.7258, lng: 101.9424, positive: 55, neutral: 30, negative: 15, buzz: 49 },
        { region: 'Melaka', lat: 2.1896, lng: 102.2501, positive: 60, neutral: 26, negative: 14, buzz: 55 },
        { region: 'Terengganu', lat: 5.3117, lng: 103.1324, positive: 47, neutral: 37, negative: 16, buzz: 44 },
        { region: 'Kelantan', lat: 6.1254, lng: 102.2381, positive: 44, neutral: 39, negative: 17, buzz: 48 },
        { region: 'Sabah', lat: 5.9788, lng: 116.0753, positive: 57, neutral: 31, negative: 12, buzz: 69 },
        { region: 'Sarawak', lat: 1.5533, lng: 110.3592, positive: 63, neutral: 26, negative: 11, buzz: 74 }
    ];

    const cleanName = clientName || 'Organization';
    const competitors = industry.toLowerCase().includes('telecom')
        ? ['Maxis', 'CelcomDigi', 'U Mobile']
        : industry.toLowerCase().includes('bank') || industry.toLowerCase().includes('finance')
        ? ['Maybank', 'CIMB', 'Public Bank']
        : industry.toLowerCase().includes('retail') || industry.toLowerCase().includes('f&b')
        ? ['Lotus’s', '99 Speedmart', 'Aeon']
        : ['Apex Global', 'Nusantara Vanguard', 'Serba Digital'];

    return {
        regionalSentiment: states,
        sentimentOverTime: {
            categories: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
            series: [
                { name: 'Positive', data: [52, 54, 57, 61, 59, 64] },
                { name: 'Neutral', data: [33, 31, 28, 25, 27, 24] },
                { name: 'Negative', data: [15, 15, 15, 14, 14, 12] }
            ]
        },
        keyTopics: {
            labels: [
                `${cleanName} CSR & Community`,
                'Service Reliability & Network',
                'Digital Transformation In Malaysia',
                'Pricing & Festive Promos',
                'Customer Support Response'
            ],
            series: [34, 28, 18, 12, 8]
        },
        shareOfVoice: {
            labels: [cleanName, competitors[0], competitors[1], competitors[2]],
            series: [41, 26, 21, 12]
        },
        sentimentComparison: {
            labels: [cleanName, competitors[0], competitors[1], competitors[2]],
            series: [
                { name: 'Positive', data: [64, 55, 48, 42] },
                { name: 'Neutral', data: [24, 30, 32, 38] },
                { name: 'Negative', data: [12, 15, 20, 20] }
            ]
        },
        competitorInsights: `In the ${industry || 'target'} landscape, ${cleanName} retains high brand resonance in Tier-1 urban centers (Klang Valley, Penang, Johor Bahru), while key competitor ${competitors[0]} is expanding community grassroots outreach in the Northern and East Coast corridors.`
    };
}

export function getFallbackPartyRegionalData(partyCode: string) {
    const isBN = partyCode === 'BN';
    const isPH = partyCode === 'PH';

    const states = [
        { region: 'Selangor', lat: 3.0738, lng: 101.5183, positive: isPH ? 63 : (isBN ? 42 : 36), neutral: 25, negative: isPH ? 12 : 33, buzz: 92 },
        { region: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869, positive: isPH ? 68 : (isBN ? 38 : 30), neutral: 20, negative: isPH ? 12 : 42, buzz: 98 },
        { region: 'Johor', lat: 1.4854, lng: 103.7618, positive: isBN ? 61 : (isPH ? 47 : 33), neutral: 26, negative: isBN ? 13 : 26, buzz: 78 },
        { region: 'Penang', lat: 5.4164, lng: 100.3327, positive: isPH ? 71 : (isBN ? 35 : 29), neutral: 18, negative: isPH ? 11 : 42, buzz: 85 },
        { region: 'Perak', lat: 4.5921, lng: 101.0901, positive: isBN ? 52 : (isPH ? 48 : 44), neutral: 30, negative: 20, buzz: 65 },
        { region: 'Kedah', lat: 6.1184, lng: 100.3685, positive: !isBN && !isPH ? 66 : (isBN ? 39 : 34), neutral: 24, negative: !isBN && !isPH ? 10 : 37, buzz: 72 },
        { region: 'Pahang', lat: 3.8126, lng: 103.3256, positive: isBN ? 58 : (isPH ? 38 : 42), neutral: 28, negative: isBN ? 14 : 34, buzz: 59 },
        { region: 'Negeri Sembilan', lat: 2.7258, lng: 101.9424, positive: isPH ? 57 : (isBN ? 51 : 33), neutral: 28, negative: 18, buzz: 54 },
        { region: 'Melaka', lat: 2.1896, lng: 102.2501, positive: isBN ? 60 : (isPH ? 46 : 32), neutral: 27, negative: 17, buzz: 56 },
        { region: 'Terengganu', lat: 5.3117, lng: 103.1324, positive: !isBN && !isPH ? 69 : (isBN ? 36 : 28), neutral: 22, negative: !isBN && !isPH ? 9 : 44, buzz: 68 },
        { region: 'Kelantan', lat: 6.1254, lng: 102.2381, positive: !isBN && !isPH ? 72 : (isBN ? 34 : 26), neutral: 20, negative: !isBN && !isPH ? 8 : 46, buzz: 70 },
        { region: 'Sabah', lat: 5.9788, lng: 116.0753, positive: isBN ? 54 : (isPH ? 50 : 38), neutral: 34, negative: 14, buzz: 72 },
        { region: 'Sarawak', lat: 1.5533, lng: 110.3592, positive: isBN ? 56 : (isPH ? 49 : 35), neutral: 35, negative: 12, buzz: 75 }
    ];

    return {
        regionalSentiment: states,
        sentimentOverTime: {
            categories: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
            series: [
                { name: 'Positive', data: [48, 50, 52, 55, 54, 57] },
                { name: 'Neutral', data: [32, 31, 30, 28, 29, 27] },
                { name: 'Negative', data: [20, 19, 18, 17, 17, 16] }
            ]
        },
        keyTopics: {
            labels: [
                'Cost of Living & Subsidies (PADU)',
                'Local Infrastructure & Rural Dev',
                'State Leadership & Seat Allocations',
                'Youth Employment & TVET',
                '3R Governance & Public Discourse'
            ],
            series: [32, 24, 20, 14, 10]
        }
    };
}

export function getFallbackPartySentimentTracker() {
    return {
        asOfPeriod: "Q3 2026",
        executiveSummary: "National political sentiment reflects stable public focus on economic mitigation, cost of living initiatives, and parliamentary legislative debates. The Unity Government coalition (PH & BN) maintains strong approval ratings in mixed urban/semi-urban seats, while PN commands sustained grassroots loyalty in northern and east-coast rural constituencies.",
        coalitions: [
            {
                code: "PH",
                name: "Pakatan Harapan (PH)",
                overallSentimentScore: 61,
                sentiment: { positive: 56, neutral: 28, negative: 16 },
                trend: "Rising",
                topLeaders: [
                    { name: "Anwar Ibrahim", approvalPct: 64 },
                    { name: "Rafizi Ramli", approvalPct: 58 },
                    { name: "Anthony Loke", approvalPct: 69 }
                ],
                strengths: [
                    "Institutional fiscal reform and inflation control measures",
                    "Strong transport & connectivity infrastructure rollout under Anthony Loke",
                    "High approval among urban multi-ethnic middle class voters"
                ],
                vulnerabilities: [
                    "Targeted diesel/petrol subsidy rationalization sensitivity",
                    "Lower narrative penetration in rural Malay heartland seats"
                ],
                trendingNarratives: [
                    "MADANI Economic Framework delivery milestones",
                    "New civil service salary adjustments scheme",
                    "Public healthcare & hospital upgrade funding"
                ]
            },
            {
                code: "BN",
                name: "Barisan Nasional (BN)",
                overallSentimentScore: 54,
                sentiment: { positive: 48, neutral: 34, negative: 18 },
                trend: "Stable",
                topLeaders: [
                    { name: "Zahid Hamidi", approvalPct: 49 },
                    { name: "Mohamad Hasan (Tok Mat)", approvalPct: 62 },
                    { name: "Wee Ka Siong", approvalPct: 53 }
                ],
                strengths: [
                    "TVET expansion and rural regional development execution",
                    "Resilient grassroots party machinery in Johor, Pahang, and Melaka",
                    "Stabilizing partner in federal governance and state stability"
                ],
                vulnerabilities: [
                    "Youth voter voter conversion rates across northern states",
                    "Balancing internal grassroots sentiments with coalition unity"
                ],
                trendingNarratives: [
                    "Rubber and palm oil smallholder welfare programs",
                    "Pahang and Johor economic corridor investments",
                    "Halal industry international export partnerships"
                ]
            },
            {
                code: "PN",
                name: "Perikatan Nasional (PN)",
                overallSentimentScore: 49,
                sentiment: { positive: 45, neutral: 33, negative: 22 },
                trend: "Steady",
                topLeaders: [
                    { name: "Muhyiddin Yassin", approvalPct: 56 },
                    { name: "Hadi Awang", approvalPct: 52 },
                    { name: "Samsuri Mokhtar", approvalPct: 65 }
                ],
                strengths: [
                    "Solid majority support in Kelantan, Terengganu, and Kedah",
                    "Effective cost of living critique in parliamentary debates",
                    "Dominant social media reach on TikTok among youth demographics"
                ],
                vulnerabilities: [
                    "Limited narrative traction in mixed urban and non-Malay constituencies",
                    "Inter-party alignment dynamics between PAS and Bersatu"
                ],
                trendingNarratives: [
                    "SG4 state economic development grouping initiatives",
                    "EPF flexible account withdrawal advocacy",
                    "Cost of living pressure points in suburban segments"
                ]
            }
        ]
    };
}
