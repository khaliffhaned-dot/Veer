// Source: Google Maps Platform Code Assist
/**
 * Google Maps Platform Integration for PRVAIL Intelligence Platform
 * Uses Maps JavaScript API with AdvancedMarkerElement, Places API (New), and Cloud-styled Maps.
 */

import { Loader } from '@googlemaps/js-api-loader';

export interface RegionalSentimentItem {
    region: string;
    lat: number;
    lng: number;
    positive: number;
    neutral: number;
    negative: number;
    buzz: number;
    narrativeNotes?: string;
    activeCrises?: number;
}

export interface GoogleMapsConfig {
    apiKey?: string;
    mapId?: string;
    center?: { lat: number; lng: number };
    zoom?: number;
}

let loaderInstance: Loader | null = null;
let googleMapsPromise: Promise<typeof google.maps> | null = null;

/**
 * Gets or creates the Google Maps JS API loader
 */
export function getGoogleMapsLoader(apiKey?: string): Loader {
    const key = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    
    if (!loaderInstance) {
        loaderInstance = new Loader({
            apiKey: key,
            version: 'weekly',
            libraries: ['places', 'marker', 'geometry'],
            // Mandatory internal usage attribution ID for Google Maps Code Assist in AI Studio
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
        });
    }
    return loaderInstance;
}

/**
 * Loads the core Google Maps libraries
 */
export async function loadGoogleMaps(apiKey?: string): Promise<{
    Map: typeof google.maps.Map;
    AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
    PinElement: typeof google.maps.marker.PinElement;
    InfoWindow: typeof google.maps.InfoWindow;
}> {
    const key = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    
    // Ensure the loader has the latest key if provided
    const loader = new Loader({
        apiKey: key,
        version: 'weekly',
        libraries: ['places', 'marker', 'geometry'],
        internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    });

    await loader.load();

    const { Map, InfoWindow } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
    const { AdvancedMarkerElement, PinElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

    return { Map, AdvancedMarkerElement, PinElement, InfoWindow };
}

export interface PRVAILMapInstance {
    map: google.maps.Map;
    markers: google.maps.marker.AdvancedMarkerElement[];
    infoWindow: google.maps.InfoWindow;
    cleanup: () => void;
    setFilter: (sentimentType: 'all' | 'positive' | 'neutral' | 'negative', minBuzz?: number) => void;
    focusRegion: (regionName: string) => void;
}

const REGION_COORDINATES: Record<string, { lat: number; lng: number; zoom?: number }> = {
    'all': { lat: 4.2105, lng: 101.9758, zoom: 6 },
    'west': { lat: 4.0000, lng: 101.8000, zoom: 7 },
    'east': { lat: 3.5000, lng: 114.5000, zoom: 7 },
    'klang_valley': { lat: 3.1390, lng: 101.6869, zoom: 11 },
    'selangor': { lat: 3.0738, lng: 101.5183, zoom: 10 },
    'kuala lumpur': { lat: 3.1390, lng: 101.6869, zoom: 12 },
    'johor': { lat: 1.4854, lng: 103.7618, zoom: 9 },
    'penang': { lat: 5.4164, lng: 100.3327, zoom: 11 },
    'perak': { lat: 4.5921, lng: 101.0901, zoom: 9 },
    'kedah': { lat: 6.1184, lng: 100.3685, zoom: 9 },
    'pahang': { lat: 3.8126, lng: 103.3256, zoom: 8 },
    'negeri sembilan': { lat: 2.7258, lng: 101.9424, zoom: 10 },
    'melaka': { lat: 2.1896, lng: 102.2501, zoom: 11 },
    'terengganu': { lat: 5.3117, lng: 103.1324, zoom: 9 },
    'kelantan': { lat: 6.1254, lng: 102.2381, zoom: 9 },
    'sabah': { lat: 5.9788, lng: 116.0753, zoom: 8 },
    'sarawak': { lat: 1.5533, lng: 110.3592, zoom: 8 },
    'putrajaya': { lat: 2.9264, lng: 101.6964, zoom: 13 },
    'perlis': { lat: 6.4449, lng: 100.2048, zoom: 11 },
    'labuan': { lat: 5.2831, lng: 115.2308, zoom: 12 }
};

/**
 * Initializes Google Maps on the specified container element with PRVAIL intelligence markers.
 */
export async function initializePRVAILGoogleMap(
    container: HTMLElement,
    data: RegionalSentimentItem[],
    options: {
        theme?: 'dark' | 'light';
        onMarkerClick?: (item: RegionalSentimentItem) => void;
        onActionDraft?: (item: RegionalSentimentItem) => void;
    } = {}
): Promise<PRVAILMapInstance> {
    const { Map, AdvancedMarkerElement, InfoWindow } = await loadGoogleMaps();

    const isDark = options.theme === 'dark' || document.body.classList.contains('dark');

    // Custom dark map styling for PRVAIL's command center theme
    const darkStyles: google.maps.MapTypeStyle[] = [
        { elementType: 'geometry', stylers: [{ color: '#1a1f2c' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f2c' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
        {
            featureType: 'administrative.locality',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#cbd5e1' }]
        },
        {
            featureType: 'poi',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#64748b' }]
        },
        {
            featureType: 'poi.park',
            elementType: 'geometry',
            stylers: [{ color: '#14202e' }]
        },
        {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#293548' }]
        },
        {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#1e293b' }]
        },
        {
            featureType: 'road',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#94a3b8' }]
        },
        {
            featureType: 'road.highway',
            elementType: 'geometry',
            stylers: [{ color: '#334155' }]
        },
        {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#0f172a' }]
        },
        {
            featureType: 'water',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#475569' }]
        }
    ];

    // Modern Map initialization with DEMO_MAP_ID to support AdvancedMarkerElement
    const map = new Map(container, {
        center: { lat: 4.2105, lng: 101.9758 },
        zoom: 6,
        mapId: 'DEMO_MAP_ID',
        styles: isDark ? darkStyles : undefined,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
        }
    });

    const infoWindow = new InfoWindow({
        disableAutoPan: false,
    });

    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    function createMarkerContent(item: RegionalSentimentItem): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'gmp-prvail-marker-container';

        const isPositive = item.positive >= item.neutral && item.positive >= item.negative;
        const isNegative = item.negative > 20 || item.negative > item.positive;
        
        let sentimentColor = '#10B981'; // Positive Emerald
        let sentimentLabel = 'Positive';
        let sentimentClass = 'marker-positive';

        if (isNegative) {
            sentimentColor = '#EF4444'; // Red / Crisis
            sentimentLabel = 'Critical';
            sentimentClass = 'marker-negative';
        } else if (!isPositive) {
            sentimentColor = '#F59E0B'; // Amber / Neutral
            sentimentLabel = 'Neutral';
            sentimentClass = 'marker-neutral';
        }

        const isHighBuzz = item.buzz >= 75;

        wrapper.innerHTML = `
            <div class="gmp-prvail-marker ${sentimentClass} ${isHighBuzz ? 'has-pulse' : ''}" style="
                display: flex;
                align-items: center;
                gap: 6px;
                background: ${isDark ? '#0f172a' : '#ffffff'};
                border: 2px solid ${sentimentColor};
                padding: 5px 10px;
                border-radius: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                cursor: pointer;
                transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                font-family: inherit;
            ">
                <div style="
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: ${sentimentColor};
                    box-shadow: 0 0 8px ${sentimentColor};
                "></div>
                <div style="display: flex; flex-direction: column; line-height: 1.1;">
                    <span style="font-size: 11px; font-weight: 700; color: ${isDark ? '#f8fafc' : '#0f172a'};">${item.region}</span>
                    <span style="font-size: 9px; font-weight: 600; color: ${sentimentColor};">${item.positive}% Pos · Buzz ${item.buzz}</span>
                </div>
                ${isHighBuzz ? `<span style="font-size: 9px; background: rgba(239,68,68,0.15); color: #ef4444; border-radius: 4px; padding: 1px 4px; font-weight: bold;">HOT</span>` : ''}
            </div>
        `;

        wrapper.addEventListener('mouseenter', () => {
            const inner = wrapper.querySelector('.gmp-prvail-marker') as HTMLElement;
            if (inner) inner.style.transform = 'scale(1.12) translateY(-2px)';
        });
        wrapper.addEventListener('mouseleave', () => {
            const inner = wrapper.querySelector('.gmp-prvail-marker') as HTMLElement;
            if (inner) inner.style.transform = 'scale(1) translateY(0)';
        });

        return wrapper;
    }

    function renderInfoWindowContent(item: RegionalSentimentItem): string {
        const isPositive = item.positive >= item.neutral && item.positive >= item.negative;
        const isNegative = item.negative > 20 || item.negative > item.positive;
        const statusBadge = isNegative 
            ? `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">⚠️ Threat Detected</span>`
            : isPositive 
            ? `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">✅ Favorable</span>`
            : `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">⚖️ Neutral / Mixed</span>`;

        return `
            <div style="font-family: inherit; color: #1e293b; padding: 6px 2px; min-width: 240px; max-width: 290px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">${item.region}</h4>
                    ${statusBadge}
                </div>
                
                <div style="background: #f8fafc; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; font-weight: 600;">
                        <span style="color:#10b981;">Positive: ${item.positive}%</span>
                        <span style="color:#64748b;">Neutral: ${item.neutral}%</span>
                        <span style="color:#ef4444;">Negative: ${item.negative}%</span>
                    </div>
                    <!-- Stacked sentiment bar -->
                    <div style="display: flex; height: 7px; border-radius: 4px; overflow: hidden; background: #e2e8f0;">
                        <div style="width: ${item.positive}%; background: #10b981;"></div>
                        <div style="width: ${item.neutral}%; background: #94a3b8;"></div>
                        <div style="width: ${item.negative}%; background: #ef4444;"></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 10px;">
                    <span style="color: #475569; font-weight: 600;">Media Buzz Index:</span>
                    <span style="font-weight: 800; color: #0f172a; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">🔥 ${item.buzz} / 100</span>
                </div>

                <div style="display: flex; gap: 6px; margin-top: 10px;">
                    <button id="gmp-focus-btn-${item.region.replace(/\s+/g, '')}" style="
                        flex: 1;
                        background: #0f172a;
                        color: #ffffff;
                        border: none;
                        border-radius: 6px;
                        padding: 6px 10px;
                        font-size: 11px;
                        font-weight: 600;
                        cursor: pointer;
                    ">Zoom Region</button>
                    <button id="gmp-draft-btn-${item.region.replace(/\s+/g, '')}" style="
                        flex: 1;
                        background: #3b82f6;
                        color: #ffffff;
                        border: none;
                        border-radius: 6px;
                        padding: 6px 10px;
                        font-size: 11px;
                        font-weight: 600;
                        cursor: pointer;
                    ">Draft Response</button>
                </div>
            </div>
        `;
    }

    // Attach markers to map
    data.forEach(item => {
        const markerContent = createMarkerContent(item);
        
        const marker = new AdvancedMarkerElement({
            map,
            position: { lat: item.lat, lng: item.lng },
            title: `${item.region} Sentiment: ${item.positive}% Pos, ${item.negative}% Neg`,
            content: markerContent
        });

        marker.addListener('click', () => {
            infoWindow.setContent(renderInfoWindowContent(item));
            infoWindow.open({
                anchor: marker,
                map,
                shouldFocus: false
            });

            setTimeout(() => {
                const cleanId = item.region.replace(/\s+/g, '');
                document.getElementById(`gmp-focus-btn-${cleanId}`)?.addEventListener('click', () => {
                    map.panTo({ lat: item.lat, lng: item.lng });
                    map.setZoom(10);
                });
                document.getElementById(`gmp-draft-btn-${cleanId}`)?.addEventListener('click', () => {
                    if (options.onActionDraft) {
                        options.onActionDraft(item);
                    }
                });
            }, 50);

            if (options.onMarkerClick) {
                options.onMarkerClick(item);
            }
        });

        markers.push(marker);
    });

    const instance: PRVAILMapInstance = {
        map,
        markers,
        infoWindow,
        cleanup: () => {
            markers.forEach(m => m.map = null);
            infoWindow.close();
        },
        setFilter: (sentimentType, minBuzz = 0) => {
            data.forEach((item, index) => {
                const marker = markers[index];
                if (!marker) return;

                const isPositive = item.positive >= item.neutral && item.positive >= item.negative;
                const isNegative = item.negative > 20 || item.negative > item.positive;
                
                let matchesSentiment = true;
                if (sentimentType === 'positive') matchesSentiment = isPositive && !isNegative;
                else if (sentimentType === 'negative') matchesSentiment = isNegative;
                else if (sentimentType === 'neutral') matchesSentiment = !isPositive && !isNegative;

                const matchesBuzz = item.buzz >= minBuzz;

                marker.map = (matchesSentiment && matchesBuzz) ? map : null;
            });
        },
        focusRegion: (regionName: string) => {
            const normalized = regionName.toLowerCase().trim();
            const config = REGION_COORDINATES[normalized] || REGION_COORDINATES['all'];
            map.panTo({ lat: config.lat, lng: config.lng });
            if (config.zoom) map.setZoom(config.zoom);
        }
    };

    return instance;
}
