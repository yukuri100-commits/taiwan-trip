import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plane, Ship, Car, Bike, Train, Bus, MapPin, Footprints, Leaf, ClipboardCheck, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';

const APP_TITLE = "My Low-Carbon Taiwan Trip";

// 交通工具與碳排數據 (g CO2/km)
const TRANSPORT_DATA: Record<string, { id: string; label: string; value: number; icon: typeof Plane }> = {
  plane: { id: "plane", label: "By Plane", value: 285, icon: Plane },
  ferry: { id: "ferry", label: "By Ferry", value: 120, icon: Ship }, // 教學假設值，非官方排放係數
  car: { id: "car", label: "By Car", value: 104, icon: Car },
  bus: { id: "bus", label: "By Bus", value: 68, icon: Bus },
  train: { id: "train", label: "By Train", value: 14, icon: Train },
  hsr: { id: "hsr", label: "By High-Speed Rail", value: 14, icon: Train },
  bike: { id: "bike", label: "By Bike", value: 0, icon: Bike },
  foot: { id: "foot", label: "On Foot", value: 0, icon: Footprints },
};

// 城市經緯度與特性
const CITIES: Record<string, { name: string; lat: number; lng: number; hasHSR: boolean; hasTrain: boolean; island?: boolean }> = {
  "Penghu": { name: "Penghu", lat: 23.565, lng: 119.566, hasHSR: false, hasTrain: false, island: true },
  "Kinmen": { name: "Kinmen", lat: 24.433, lng: 118.32, hasHSR: false, hasTrain: false, island: true },
  "Matsu": { name: "Matsu", lat: 26.16, lng: 119.95, hasHSR: false, hasTrain: false, island: true },
  "Keelung": { name: "Keelung", lat: 25.1283, lng: 121.7419, hasHSR: false, hasTrain: true },
  "Taipei": { name: "Taipei", lat: 25.0375, lng: 121.5625, hasHSR: true, hasTrain: true },
  "Yilan": { name: "Yilan", lat: 24.7562, lng: 121.7516, hasHSR: false, hasTrain: true },
  "Hualien": { name: "Hualien", lat: 23.9769, lng: 121.6044, hasHSR: false, hasTrain: true },
  "Taitung": { name: "Taitung", lat: 22.7583, lng: 121.1444, hasHSR: false, hasTrain: true },
  "Pingtung": { name: "Pingtung", lat: 22.6728, lng: 120.4878, hasHSR: false, hasTrain: true },
  "Kaohsiung": { name: "Kaohsiung", lat: 22.6150, lng: 120.2975, hasHSR: true, hasTrain: true },
  "Tainan": { name: "Tainan", lat: 22.9997, lng: 120.2270, hasHSR: true, hasTrain: true },
  "Chiayi": { name: "Chiayi", lat: 23.4799, lng: 120.4491, hasHSR: true, hasTrain: true },
  "Yunlin": { name: "Yunlin", lat: 23.7092, lng: 120.4313, hasHSR: true, hasTrain: true },
  "Nantou": { name: "Nantou", lat: 23.9056, lng: 120.6905, hasHSR: false, hasTrain: false }, // 無火車直達
  "Changhua": { name: "Changhua", lat: 24.0815, lng: 120.5385, hasHSR: true, hasTrain: true },
  "Taichung": { name: "Taichung", lat: 24.1439, lng: 120.6794, hasHSR: true, hasTrain: true },
  "Miaoli": { name: "Miaoli", lat: 24.5601, lng: 120.8214, hasHSR: true, hasTrain: true },
  "Hsinchu": { name: "Hsinchu", lat: 24.8138, lng: 120.9675, hasHSR: true, hasTrain: true },
  "Taoyuan": { name: "Taoyuan", lat: 24.9913, lng: 121.3143, hasHSR: true, hasTrain: true }
};

const DESTINATION_OPTIONS = Object.keys(CITIES).filter(c => c !== "Taipei");
const SEQUENCE_ADVERBS = ["First", "Next", "Then", "Finally"];
const MAX_PLACES = 3;

// Haversine formula 計算直線距離 (km)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};


type TripStep = { from: string; to: string; transport: string; distance: number; carbon: number; hours: number; routeName?: string; routeWarning?: string };
type GeoPoint = [number, number];
const ROUTE_COLORS = ["#2563eb", "#c2410c", "#7c3aed", "#047857"];
const VEHICLES: Record<string, string> = { plane: "✈️", ferry: "⛴️", car: "🚗", bus: "🚌", train: "🚆", hsr: "🚄", bike: "🚲", foot: "🚶" };

// Approximate lowland travel corridor, NOT road/rail geometry. No routing API.
// South and east intermediate points avoid a straight cross-mountain shortcut.
const CORRIDOR: GeoPoint[] = [
  [25.0375,121.5625],[24.9913,121.3143],[24.8138,120.9675],
  [24.5601,120.8214],[24.1439,120.6794],[24.0815,120.5385],
  [23.7092,120.4313],[23.4799,120.4491],[22.9997,120.2270],
  [22.6150,120.2975],[22.6728,120.4878],[22.365,120.596],
  [22.28,120.70],[22.34,120.85],[22.60,121.00],
  [22.7583,121.1444],[23.10,121.21],[23.34,121.31],
  [23.67,121.42],[23.9769,121.6044],[24.15,121.65],
  [24.35,121.76],[24.59,121.85],[24.7562,121.7516],
  [24.94,121.82],[25.10,121.74]
];
const pointDistance = (a: GeoPoint, b: GeoPoint) =>
  Math.hypot((a[0]-b[0]), (a[1]-b[1])*Math.cos((a[0]+b[0])*Math.PI/360));

type RouteProfile = { path: GeoPoint[]; name: string; warning?: string; carSpeed?: number; busSpeed?: number; distanceFactor?: number };
const cityPoint=(name:string):GeoPoint=>[CITIES[name].lat,CITIES[name].lng];
const samePair=(a:string,b:string,x:string,y:string)=>(a===x&&b===y)||(a===y&&b===x);
const orient=(from:string,forwardFrom:string,path:GeoPoint[])=>from===forwardFrom?path:[...path].reverse();

// Fixed classroom corridors: geographic illustrations, not live navigation.
// Only cars and buses use the major cross-island road corridors. Rail stays on
// the perimeter railway, while walking and cycling never enter freeways.
function specialRoadProfile(from:string,to:string,transport:string):RouteProfile|null {
  if(transport!=="car"&&transport!=="bus")return null;
  if(samePair(from,to,"Taipei","Yilan")){
    const path=[cityPoint("Taipei"),[25.05,121.61],[24.99,121.65],[24.94,121.71],[24.86,121.82],cityPoint("Yilan")] as GeoPoint[];
    return {path:orient(from,"Taipei",path),name:"National Freeway 5 · Snow Mountain Tunnel",carSpeed:70,busSpeed:55,distanceFactor:1.06};
  }
  if(samePair(from,to,"Taoyuan","Yilan")){
    const path=[cityPoint("Taoyuan"),[24.88,121.29],[24.68,121.38],[24.65,121.47],[24.75,121.80],cityPoint("Yilan")] as GeoPoint[];
    return {path:orient(from,"Taoyuan",path),name:"Northern Cross-Island Highway · Hwy 7",warning:"Mountain road · Check road conditions. 山區道路，行前須查詢路況。",carSpeed:35,busSpeed:30,distanceFactor:1.1};
  }
  if(samePair(from,to,"Taichung","Hualien")){
    const path=[cityPoint("Taichung"),[23.97,120.97],[24.02,121.13],[24.14,121.28],[24.18,121.31],[24.18,121.49],[24.16,121.62],cityPoint("Hualien")] as GeoPoint[];
    return {path:orient(from,"Taichung",path),name:"Central Mountain Route · Hwy 8 / Hwy 14A / Freeway 6",warning:"Mountain controls and road conditions may change. 山區管制與路況可能變動。",carSpeed:35,busSpeed:30,distanceFactor:1.1};
  }
  if(to==="Taitung"&&["Pingtung","Kaohsiung","Tainan"].includes(from)||from==="Taitung"&&["Pingtung","Kaohsiung","Tainan"].includes(to)){
    const west=from==="Taitung"?to:from;
    const prefix:GeoPoint[]=west==="Tainan"?[cityPoint("Tainan"),[22.80,120.30],cityPoint("Pingtung")]:west==="Kaohsiung"?[cityPoint("Kaohsiung"),cityPoint("Pingtung")]:[cityPoint("Pingtung")];
    const path=[...prefix,[22.36,120.63],[22.24,120.72],[22.23,120.86],[22.36,120.94],[22.58,121.01],cityPoint("Taitung")] as GeoPoint[];
    return {path:from===west?path:[...path].reverse(),name:"South-Link Highway · Hwy 9",carSpeed:50,busSpeed:40,distanceFactor:1.08};
  }
  return null;
}

function routeProfile(from:string,to:string,transport:string):RouteProfile|null {
  const special=specialRoadProfile(from,to,transport);
  if(special)return special;
  if(transport==="plane")return {path:[cityPoint(from),cityPoint(to)],name:"Air route",distanceFactor:1};
  if(transport==="hsr")return {path:[],name:"Taiwan High Speed Rail",distanceFactor:1.08};
  if(transport==="train")return {path:[],name:"Taiwan Rail",distanceFactor:1.1};
  if(transport==="car"||transport==="bus")return {path:[],name:"Main road route",distanceFactor:1.12};
  if(transport==="bike")return {path:[],name:"Cycling route",distanceFactor:1.12};
  if(transport==="foot")return {path:[],name:"Walking route",distanceFactor:1.12};
  return null;
}
function illustrativePath(step: TripStep): GeoPoint[] {
  const a = CITIES[step.from], b = CITIES[step.to];
  const start: GeoPoint = [a.lat,a.lng], end: GeoPoint = [b.lat,b.lng];
  const profile=routeProfile(step.from,step.to,step.transport);
  if(profile?.path.length)return profile.path;
  if (step.transport === "ferry") {
    const mainland = a.island ? step.to : step.from;
    const sea: GeoPoint[] = mainland === "Chiayi"
      ? [[CITIES.Chiayi.lat,CITIES.Chiayi.lng],[23.379,120.158],[23.38,119.98],[23.49,119.55],[23.565,119.566]]
      : mainland === "Kaohsiung"
        ? [[CITIES.Kaohsiung.lat,CITIES.Kaohsiung.lng],[22.617,120.276],[22.61,120.1],[23.35,119.4],[23.565,119.566]]
        : [[CITIES.Keelung.lat,CITIES.Keelung.lng],[25.15,121.75],[25.3,121.75],[26.16,119.95]];
    return a.island ? [...sea].reverse() : sea;
  }
  const nearest = (p: GeoPoint) => CORRIDOR.reduce((best, q, i) =>
    pointDistance(p,q) < pointDistance(p,CORRIDOR[best]) ? i : best, 0);
  const startIndex = nearest(start), endIndex = nearest(end);
  const walk = (direction: number) => {
    const path: GeoPoint[] = [start,CORRIDOR[startIndex]];
    let i = startIndex;
    while(i !== endIndex) { i=(i+direction+CORRIDOR.length)%CORRIDOR.length; path.push(CORRIDOR[i]); }
    path.push(end);
    return path;
  };
  const forward=walk(1), backward=walk(-1);
  const length = (p: GeoPoint[]) => p.slice(1).reduce((sum,q,i)=>sum+pointDistance(q,p[i]),0);
  return length(forward)<=length(backward) ? forward : backward;
}
function pointAlong(path: GeoPoint[], fraction: number): GeoPoint {
  const lengths=path.slice(1).map((p,i)=>pointDistance(p,path[i]));
  const total=lengths.reduce((sum,x)=>sum+x,0);
  let remaining=Math.min(1,Math.max(0,fraction))*total;
  for(let i=0;i<lengths.length;i++){
    if(remaining<=lengths[i] && lengths[i]>0){
      const t=remaining/lengths[i];
      return [path[i][0]+(path[i+1][0]-path[i][0])*t,path[i][1]+(path[i+1][1]-path[i][1])*t];
    }
    remaining-=lengths[i];
  }
  return path[path.length-1];
}

/** Teacher settings: four days, one travel leg and one primary transport per day.
 * All speeds, waiting times and carbon factors are classroom estimates, not timetables.
 * Selected gateway routes are an activity subset, not a complete service directory.
 */
const MAX_LEG_HOURS = 8;
const PLANE_GATEWAYS: Record<string,string[]> = {
  Penghu: ["Taipei","Taichung","Chiayi","Tainan","Kaohsiung","Kinmen"],
  Kinmen: ["Taipei","Taichung","Chiayi","Tainan","Kaohsiung","Penghu"],
  Matsu: ["Taipei","Taichung","Kaohsiung"] // 松山、清泉崗、小港：依教師提供的航點設定
};
const pair = (a:string,b:string) => [a,b].sort().join("|");
const FERRY_HOURS: Record<string,number> = {
  [pair("Chiayi","Penghu")]: 3, // includes Budai bus transfer and boarding
  [pair("Kaohsiung","Penghu")]: 5.5,
  [pair("Keelung","Matsu")]: 9 // 8–10 小時的課堂中間值，特例開放
};
const isMatsuFerry=(from:string,to:string,mode:string)=>mode==="ferry"&&pair(from,to)===pair("Keelung","Matsu");
const FERRY_WARNING="運行時間約 8 至 10 小時";
function routeEstimate(from:string,to:string,transport:string) {
  const a=CITIES[from], b=CITIES[to];
  let reason="";
  const island=a.island ? from : b.island ? to : "";
  const gateway=a.island ? to : from;
  if(transport==="plane") {
    if(!island || !PLANE_GATEWAYS[island]?.includes(gateway))
      reason="No direct flight in this activity. Try Taipei, Taichung or Kaohsiung. 本活動未提供這條直飛路線。";
  } else if(transport==="ferry") {
    if(FERRY_HOURS[pair(from,to)]===undefined)
      reason="Ferry ports: Chiayi / Kaohsiung ↔ Penghu; Keelung ↔ Matsu. 請先到有渡輪的港口城市。";
  } else if(a.island || b.island) {
    reason="We must cross the sea. Choose a plane or ferry. 跨海不能步行、騎車或搭火車。";
  } else if(transport==="hsr" && (!a.hasHSR || !b.hasHSR)) {
    reason="No high-speed rail stop here. 這裡沒有高鐵站。";
  } else if(transport==="train" && (!a.hasTrain || !b.hasTrain)) {
    reason="No train station here. 這裡沒有火車站。";
  }
  const path=illustrativePath({from,to,transport,distance:0,carbon:0,hours:0});
  const length=(p:GeoPoint[])=>p.slice(1).reduce((sum,q,i)=>sum+calculateDistance(...p[i],...q),0);
  const profile=routeProfile(from,to,transport);
  const distance=Math.max(1,Math.round(length(path)*(transport==="ferry"?1:profile?.distanceFactor??1.12)));
  const speed:Record<string,number>={foot:4,bike:12,car:60,bus:45,train:70,hsr:180,plane:450,ferry:35};
  const overhead:Record<string,number>={foot:0,bike:0,car:0.25,bus:0.5,train:0.5,hsr:0.75,plane:1.5,ferry:1};
  const corridorSpeed=transport==="car"?profile?.carSpeed:transport==="bus"?profile?.busSpeed:undefined;
  const hours=transport==="ferry" ? FERRY_HOURS[pair(from,to)]??99 : distance/(corridorSpeed??speed[transport])+overhead[transport];
  if(!reason && transport==="foot" && distance>30) reason="Too far to walk in our day trip (30 km max). 一日步行上限 30 公里。";
  if(!reason && transport==="bike" && distance>80) reason="Too far to cycle in our day trip (80 km max). 一日騎車上限 80 公里。";
  if(!reason && hours>MAX_LEG_HOURS && !isMatsuFerry(from,to,transport))reason="Too long for this day. 這段超過每日 8 小時交通上限。";
  const transferKm=transport==="ferry" ? length(a.island?path.slice(-2):path.slice(0,2)) : 0;
  const carbon=Math.round(Math.max(0,distance-transferKm)*TRANSPORT_DATA[transport].value+transferKm*TRANSPORT_DATA.bus.value);
  return {disabled:!!reason,reason,distance,hours,carbon,routeName:transport==="ferry"?"Ferry and port transfer":profile?.name??"Illustrative route",routeWarning:profile?.warning??""};
}
const hoursText=(n:number)=>Math.round(n*60/5)*5<60
  ? Math.round(n*60/5)*5+" min"
  : Math.floor(Math.round(n*60/5)*5/60)+" h "+(Math.round(n*60/5)*5%60)+" min";

// Embedded Natural Earth 1:10m land polygons (public domain), clipped to this region.
// https://www.naturalearthdata.com/about/terms-of-use/
// Fixed equirectangular projection: every place, coast and animation uses the SAME coordinates.
const LAND_PATHS: string[] = ["M-0.0,-0.0L385.3,-0.0L385.2,2.4L382.9,4.6L381.9,3.5L380.0,4.3L377.0,4.7L371.1,4.6L376.2,7.3L377.8,7.6L379.7,7.2L381.3,6.7L382.6,6.9L383.7,8.5L382.5,9.9L382.9,12.6L381.7,13.2L380.4,14.3L379.2,14.5L378.0,14.3L373.7,12.6L370.9,12.3L368.1,12.5L366.5,13.8L367.4,16.5L365.9,17.3L365.0,17.9L364.1,18.3L362.4,18.5L361.1,17.5L360.1,16.8L358.8,16.5L355.6,16.5L358.7,18.0L357.3,19.9L354.7,22.3L354.7,25.5L355.9,26.7L357.7,27.6L359.8,28.3L361.5,28.5L362.7,29.0L364.2,30.1L366.1,31.2L368.4,31.4L367.3,33.3L365.6,35.1L364.4,37.0L364.7,39.3L366.3,40.3L368.5,40.4L370.3,40.7L371.1,42.4L370.4,44.0L368.9,44.5L367.1,44.6L365.7,45.3L364.9,47.1L365.1,49.1L366.0,51.2L367.4,53.3L369.2,52.2L369.2,53.3L364.5,55.9L363.4,56.8L362.1,57.5L361.5,55.6L362.9,54.3L362.0,53.3L355.1,57.8L353.4,58.4L346.1,58.4L344.6,59.1L343.6,61.0L343.1,63.4L342.9,65.7L336.1,71.1L331.2,71.1L329.6,69.9L329.2,67.2L329.7,65.6L331.3,65.7L332.2,64.1L331.8,61.3L332.0,60.2L334.0,58.5L336.6,57.5L342.0,56.3L344.1,55.4L347.2,53.0L349.3,52.2L348.6,49.9L349.6,48.5L351.4,44.4L352.9,42.4L353.8,43.0L355.1,43.3L355.5,41.9L361.7,33.1L362.0,31.4L360.3,30.9L353.4,32.4L344.3,31.4L341.5,32.1L341.3,33.7L342.9,36.9L341.4,40.8L338.4,44.0L336.6,47.3L338.4,51.3L335.5,52.0L332.5,52.2L332.0,47.3L328.8,43.3L327.5,43.9L325.3,46.4L323.8,47.3L323.8,44.8L325.2,35.8L326.4,34.5L330.2,32.4L328.7,31.6L327.0,31.3L325.3,31.6L323.8,32.4L324.6,28.6L326.9,27.3L329.5,26.3L331.1,23.4L327.5,23.9L324.7,25.0L322.5,26.9L321.0,29.5L320.3,31.9L320.4,33.3L320.8,34.7L321.0,36.9L320.5,39.0L319.1,40.0L317.4,40.1L315.7,39.3L316.0,36.3L315.1,33.0L313.3,29.9L310.7,28.5L309.8,29.3L309.0,31.1L308.5,33.0L308.4,34.4L308.8,36.3L309.5,37.6L313.0,41.2L314.4,41.9L315.3,42.9L315.7,44.8L315.0,45.8L313.4,45.5L311.2,44.3L309.1,42.3L306.9,39.6L304.5,37.8L301.9,38.4L301.1,36.0L301.4,34.3L301.3,32.9L299.2,31.4L298.1,31.4L296.4,31.8L295.2,32.7L295.7,34.4L294.7,35.9L292.8,37.0L292.1,38.4L291.8,40.1L292.0,41.9L292.4,43.3L293.0,44.3L294.6,45.0L296.3,44.9L297.9,45.0L299.2,46.3L299.5,47.9L299.3,49.9L298.4,53.3L294.2,50.6L293.0,50.3L291.1,50.9L290.6,51.8L291.2,54.8L292.4,57.8L297.4,61.3L298.4,64.3L300.9,61.8L303.4,60.2L306.1,58.9L308.4,57.3L310.0,58.4L311.8,58.8L315.7,58.4L314.7,58.4L316.3,58.3L317.3,58.7L316.5,61.2L318.1,61.7L321.2,62.3L322.9,63.2L322.6,65.1L322.9,67.2L321.5,65.9L319.9,67.1L320.4,69.5L322.2,71.5L324.7,72.2L324.1,73.3L322.9,74.2L324.2,74.9L325.2,76.0L326.5,78.2L327.3,80.0L327.4,81.3L327.1,82.5L326.5,84.1L324.4,84.0L323.9,86.6L321.2,88.0L319.9,87.9L318.6,84.4L316.7,82.7L314.2,81.5L311.6,81.0L310.3,80.4L307.0,75.6L305.5,74.8L304.7,75.4L303.9,77.1L301.8,78.7L299.2,78.2L295.7,78.7L294.6,79.5L294.0,81.0L294.9,83.5L297.6,84.1L300.6,83.6L301.9,82.6L303.7,82.6L304.8,83.6L305.6,84.8L305.8,95.4L307.1,97.7L310.2,98.0L309.5,100.4L311.2,101.1L316.4,100.3L317.9,99.5L318.1,95.0L318.9,93.1L321.0,94.1L322.3,92.6L322.9,91.0L323.2,89.4L323.8,88.1L324.6,87.4L328.3,85.1L329.5,87.2L331.1,88.7L331.7,90.0L330.2,92.1L332.3,92.2L335.5,94.3L337.5,95.0L339.3,94.7L342.8,93.3L344.8,93.0L344.8,94.1L336.6,100.8L335.2,101.6L332.2,99.5L328.5,99.4L325.1,101.0L322.9,104.0L325.6,104.9L324.0,105.8L322.9,105.4L321.8,104.5L320.2,104.0L318.8,104.3L316.0,105.7L314.2,106.0L311.0,106.0L308.2,106.3L305.6,107.5L302.9,110.0L305.3,110.7L307.5,111.9L307.0,113.4L307.5,114.9L305.4,115.4L303.3,116.3L301.7,117.6L301.1,119.4L300.2,120.6L298.4,121.4L297.3,122.9L298.4,125.9L293.3,128.9L290.1,133.0L287.6,137.6L284.4,142.2L281.6,147.4L279.7,149.5L276.6,149.7L274.8,146.7L273.9,145.7L272.6,145.0L269.7,144.3L268.4,143.8L264.4,140.9L262.3,140.0L255.7,139.3L253.6,138.2L249.8,134.3L247.5,132.5L245.6,131.8L240.3,130.8L239.0,130.2L234.9,127.3L232.7,126.2L231.3,125.9L234.3,129.1L237.0,132.1L239.8,133.8L243.0,132.7L244.8,134.3L245.5,136.0L246.6,140.7L247.7,142.8L250.4,146.1L251.1,147.7L251.6,151.8L252.7,152.3L258.2,153.2L262.6,155.1L264.9,155.6L269.0,155.5L273.2,154.3L277.4,152.2L283.9,147.8L284.8,146.7L285.2,145.5L285.4,142.8L285.7,141.8L287.7,140.5L292.4,140.4L294.0,139.7L301.0,143.6L304.8,144.8L308.4,143.8L311.1,146.6L311.8,147.7L312.0,149.2L311.5,151.0L308.4,157.7L307.1,159.3L305.6,160.5L303.8,161.3L301.5,161.6L300.6,162.6L298.4,169.6L296.3,164.8L295.0,163.7L294.0,165.6L295.5,167.0L295.7,170.0L296.2,173.1L298.8,174.5L299.5,175.3L299.5,177.1L299.2,180.5L300.6,181.1L300.6,182.9L298.0,185.9L297.6,187.3L297.5,191.5L296.7,192.6L295.8,193.4L294.8,193.4L293.7,192.0L289.9,189.6L288.2,189.7L287.5,191.9L285.3,192.0L283.5,192.3L282.1,193.4L281.1,192.9L278.4,192.4L279.3,195.8L279.8,200.2L280.8,203.0L283.0,201.3L282.4,204.8L282.7,207.8L284.2,210.1L287.5,211.3L288.7,209.2L289.7,208.5L291.7,209.8L292.9,210.3L294.2,209.5L295.2,208.2L295.7,207.2L294.2,212.6L294.8,214.7L297.5,215.2L296.8,216.3L295.4,217.3L294.0,217.2L296.0,218.2L297.1,218.4L298.4,218.3L296.8,219.7L294.8,220.3L298.2,220.6L298.4,222.3L299.9,223.3L301.4,223.9L302.1,225.1L301.5,226.7L300.3,228.4L301.8,228.5L302.9,229.2L304.4,232.5L304.5,235.1L303.4,237.2L301.1,239.1L303.4,239.3L304.5,239.6L305.7,240.1L298.8,241.8L295.7,242.1L296.2,240.8L296.8,239.7L297.6,238.8L298.4,238.2L296.9,233.8L295.5,231.3L296.1,230.3L297.1,229.4L297.5,228.3L295.3,224.9L294.2,224.4L293.3,224.8L292.6,225.5L291.6,225.7L290.3,225.1L289.9,226.8L289.7,229.1L289.9,231.2L290.7,232.1L292.6,232.5L292.1,235.6L291.1,237.3L288.6,237.8L285.6,237.8L283.0,238.2L284.0,236.4L284.9,234.1L285.5,231.7L285.7,229.7L284.8,228.7L284.0,227.2L284.3,226.1L285.6,224.9L285.9,223.5L280.7,223.1L279.7,224.4L279.0,226.8L278.2,228.4L276.6,227.2L276.3,225.4L278.0,220.9L278.4,218.7L277.5,218.1L267.4,216.5L266.2,215.6L265.7,213.7L266.1,212.1L269.4,206.3L267.8,207.2L266.7,208.3L265.7,207.2L266.1,205.0L264.4,203.7L261.7,203.4L259.4,204.3L261.5,206.8L260.1,208.2L255.8,209.3L255.0,211.2L254.6,215.6L253.5,217.7L250.5,222.1L249.3,223.1L247.4,223.8L243.2,224.6L241.7,225.7L240.3,226.9L236.0,229.7L234.4,230.2L232.5,231.1L233.5,233.0L239.7,239.4L240.8,241.3L241.3,243.6L241.9,244.9L243.2,244.2L244.4,242.4L244.8,240.1L245.9,240.1L248.5,246.1L245.6,247.6L244.4,248.6L243.0,250.1L244.5,252.1L245.0,253.8L247.6,252.9L248.9,251.4L250.0,249.2L250.9,246.7L251.1,244.1L252.6,245.2L254.1,246.0L255.2,245.8L255.8,244.1L257.2,244.8L258.5,246.1L258.3,247.5L261.2,251.5L263.4,252.5L265.0,253.2L265.7,254.5L264.6,256.9L261.8,257.5L256.2,257.0L255.0,258.4L257.2,264.6L256.2,266.0L252.8,266.5L251.1,264.5L249.3,264.0L247.1,265.0L244.5,265.6L242.2,266.4L240.8,264.2L239.3,262.0L237.8,260.0L234.3,261.0L232.4,263.5L232.8,265.5L234.1,266.9L234.8,268.7L235.5,269.5L236.1,270.4L236.7,271.9L238.4,271.2L239.2,271.7L238.8,272.9L236.7,273.9L234.4,273.6L232.7,272.7L231.3,272.3L230.3,273.9L231.3,274.9L232.1,275.9L230.8,275.5L227.5,273.9L228.8,270.9L229.4,269.9L227.5,268.4L226.0,269.1L225.0,271.3L224.8,273.9L222.8,271.6L223.5,269.0L226.7,265.0L228.1,262.5L228.1,260.6L226.6,259.4L223.6,259.0L217.3,259.8L214.9,259.2L216.3,256.5L219.0,255.2L222.3,254.4L222.6,251.7L216.8,251.0L208.2,253.7L206.7,254.5L205.2,254.7L202.5,256.6L201.0,258.9L203.6,260.0L207.2,260.5L207.5,261.7L206.9,263.6L207.7,266.0L208.5,264.7L210.1,263.8L212.1,263.4L214.1,263.9L215.6,265.5L215.3,267.1L213.1,269.9L212.2,272.1L212.2,274.8L211.4,276.2L210.4,276.9L208.5,277.3L206.1,277.1L203.8,276.6L201.4,277.4L200.1,277.8L198.9,279.4L199.0,281.3L200.4,283.8L202.8,286.1L205.1,287.1L210.4,288.8L209.5,289.8L211.1,291.0L212.8,291.6L214.6,291.3L216.3,290.3L217.7,286.2L218.6,284.2L219.5,284.7L219.4,286.1L218.9,288.5L218.1,290.7L217.2,291.7L216.7,292.7L217.3,294.9L218.6,298.8L220.7,298.1L220.1,299.6L218.0,301.1L215.9,301.6L215.0,300.2L214.1,298.6L212.1,298.3L207.2,298.8L205.9,301.0L207.0,305.5L210.2,308.5L215.0,306.7L215.5,307.7L215.0,308.6L215.8,309.7L212.6,310.7L208.9,310.9L205.4,310.0L202.7,308.2L201.3,307.8L197.4,309.3L195.9,309.7L194.1,309.2L192.8,308.2L191.4,307.8L189.5,308.6L189.8,311.2L187.4,312.6L184.0,313.5L181.3,314.7L180.0,314.2L179.2,313.5L179.0,312.4L179.4,310.6L180.2,309.8L182.6,309.0L183.1,306.4L181.9,304.0L180.2,302.0L178.6,300.6L178.9,305.5L178.6,306.7L177.7,307.1L177.2,306.0L177.1,304.3L177.6,302.7L176.9,302.0L176.2,301.1L174.9,298.8L174.1,300.6L171.8,303.0L171.3,304.2L172.3,305.3L174.2,306.7L175.7,308.4L175.4,310.2L172.8,311.3L169.2,311.2L165.4,310.2L162.3,308.6L167.7,312.9L168.6,314.7L168.7,316.8L168.4,318.5L168.3,320.2L170.3,324.3L171.0,325.0L171.3,324.1L172.8,323.5L174.0,323.6L174.9,323.6L177.4,322.0L178.9,320.8L179.4,319.5L180.7,320.3L181.2,321.2L181.4,322.5L181.3,324.1L181.9,325.4L183.0,325.4L185.0,324.6L187.1,325.7L187.7,328.0L185.6,331.9L183.5,333.1L181.9,334.7L179.0,339.0L177.3,340.4L176.0,339.6L174.8,338.0L173.1,336.5L171.5,338.6L170.7,340.8L170.5,343.1L170.4,346.0L171.3,347.5L173.1,347.6L174.5,348.2L174.1,351.4L172.1,354.6L168.7,357.9L164.8,360.4L161.4,361.2L160.3,362.0L159.6,360.3L159.5,359.1L159.5,357.8L159.9,356.8L160.9,356.3L163.1,355.8L162.1,354.5L152.9,348.8L150.9,348.4L149.4,347.9L145.5,345.8L143.2,345.5L143.8,343.5L144.1,341.4L144.1,337.0L143.6,335.5L142.5,336.5L141.0,338.4L139.6,339.5L142.4,346.4L140.1,349.0L136.8,351.4L133.1,352.6L129.5,351.4L128.5,351.9L127.2,351.7L124.1,350.3L123.6,352.2L122.6,353.7L121.4,354.3L119.6,353.5L118.5,358.2L115.5,358.5L112.2,356.3L110.5,353.5L110.6,350.3L111.9,349.9L113.7,350.2L115.1,349.4L115.0,347.9L113.5,346.9L111.4,346.4L109.6,346.4L110.8,343.8L111.3,341.7L110.5,339.5L107.8,336.5L107.4,340.9L106.5,341.5L105.2,341.7L104.7,345.1L103.8,347.1L102.7,348.9L101.4,350.3L101.1,352.3L100.2,352.2L98.7,350.3L92.4,347.4L91.4,350.3L92.4,353.5L91.4,355.7L89.3,356.5L86.9,355.4L87.7,352.8L85.5,354.1L83.2,356.9L83.7,358.3L89.2,359.2L92.3,360.4L94.2,362.2L92.4,364.8L91.4,365.8L90.1,366.2L88.3,366.3L87.4,367.3L86.4,368.7L87.5,369.5L89.2,371.1L89.4,372.4L86.0,372.2L74.8,367.6L69.0,366.0L63.4,367.3L66.1,368.1L68.8,368.3L71.2,369.0L73.4,371.3L62.1,368.6L58.8,369.2L69.9,379.5L74.2,381.2L85.1,379.8L89.1,378.1L90.5,377.1L92.2,378.0L92.8,379.1L92.7,380.5L91.9,384.0L90.5,385.1L89.7,386.1L88.6,389.6L89.7,390.1L91.4,389.0L92.4,387.6L93.5,386.7L96.0,386.4L98.5,387.5L99.6,390.6L101.9,392.8L102.5,396.5L102.7,397.7L103.2,399.0L100.9,399.1L97.7,400.9L96.0,400.1L94.4,401.4L91.6,405.1L89.7,407.0L88.6,407.5L86.0,408.4L85.1,409.0L84.2,412.5L83.7,413.5L82.2,413.8L81.5,411.8L81.0,407.6L79.0,406.2L77.5,406.8L76.0,408.5L74.2,410.0L77.5,411.1L78.2,413.6L77.3,416.5L73.4,422.7L72.7,424.4L72.4,426.4L72.7,428.2L73.1,429.7L73.2,431.2L72.4,432.9L68.3,431.9L65.2,433.6L59.7,439.9L56.3,443.0L55.4,444.6L55.1,447.2L54.5,449.3L53.1,450.4L51.6,450.3L50.6,448.7L51.8,444.2L58.9,436.8L59.7,433.8L58.2,432.9L54.9,434.8L54.3,433.4L56.0,432.5L56.8,431.6L56.6,430.4L56.1,429.5L55.1,426.8L53.4,431.6L50.0,432.1L45.7,430.3L42.4,427.9L42.9,430.0L44.1,431.3L45.7,431.9L47.9,431.9L45.2,437.4L45.1,440.0L46.1,443.7L43.0,446.9L39.9,450.2L38.0,455.2L36.9,460.2L37.0,464.2L38.7,466.9L36.1,469.7L35.2,471.4L32.4,475.1L32.1,472.4L31.8,469.2L33.8,466.2L33.5,461.1L33.3,458.4L32.5,455.7L31.2,453.1L29.7,451.0L27.8,449.6L25.2,448.7L16.9,448.5L14.3,447.8L11.0,445.2L9.2,444.7L8.0,446.7L8.3,449.6L10.6,450.0L13.6,449.5L16.1,449.8L20.2,455.3L18.9,461.3L15.4,467.7L11.6,469.5L4.7,466.7L2.9,467.1L1.8,468.0L1.0,469.3L-0.0,470.4Z","M16.1,472.8L20.8,473.3L23.8,474.7L22.4,478.1L19.7,477.6L18.2,478.9L17.2,482.0L17.6,485.9L15.9,486.6L13.0,485.6L11.3,486.3L9.8,488.3L9.4,491.0L9.1,493.8L10.2,494.7L11.2,497.5L3.6,499.0L-0.0,498.9L-0.0,494.4L2.9,491.8L6.2,483.5L5.3,482.7L3.8,482.0L2.2,481.7L1.2,482.0L-0.0,482.7L-0.0,480.0L3.9,476.3L3.8,473.6L3.4,470.8L5.2,469.7L7.6,469.7L8.8,470.1L9.6,472.6L11.6,473.1L13.3,474.4L16.1,472.8Z","M259.4,141.8L267.9,144.9L272.1,147.6L272.6,150.2L270.7,151.8L269.4,151.8L268.2,151.1L264.8,150.4L260.3,148.9L259.0,148.2L257.4,147.7L255.2,147.4L253.1,146.8L252.2,145.2L251.6,143.1L250.4,141.6L249.0,140.1L247.8,138.4L246.7,132.7L248.3,134.0L251.2,138.7L253.1,140.1L255.0,140.9L259.4,141.8Z","M98.7,356.3L101.3,357.9L104.8,359.2L108.1,359.9L110.5,359.4L110.6,361.2L111.6,364.1L111.5,365.4L110.4,366.9L109.2,367.6L108.2,368.6L107.8,370.7L106.9,373.6L104.6,374.8L101.6,374.6L98.7,373.4L97.2,372.4L96.2,371.4L95.8,370.3L96.0,369.2L97.3,368.5L98.9,368.2L100.1,367.4L100.6,365.4L97.4,367.1L96.4,366.8L96.0,364.8L96.5,362.7L98.3,358.9L98.7,356.3Z","M331.1,214.2L329.5,212.4L327.4,212.9L325.5,214.8L324.8,217.2L325.8,220.1L330.2,222.5L331.1,225.1L327.7,224.2L324.2,224.9L321.2,226.7L319.3,229.2L319.3,230.9L319.6,232.5L317.0,232.9L314.6,232.0L312.2,230.6L310.8,228.5L311.4,225.8L312.9,224.5L313.3,223.3L313.2,221.5L311.7,222.1L310.2,222.3L308.8,222.1L307.5,221.3L308.7,219.3L309.8,218.4L311.2,218.1L318.1,219.1L320.5,218.6L322.0,216.3L319.5,215.0L315.2,215.9L313.8,214.2L314.0,213.0L315.7,207.8L315.3,206.3L314.2,206.3L312.9,207.1L312.0,208.3L310.7,205.8L311.5,203.2L313.5,200.6L315.7,198.3L317.7,197.9L320.1,196.4L322.5,196.4L321.9,197.4L321.7,199.8L322.3,202.5L323.9,204.3L325.4,203.4L326.7,203.7L328.0,204.8L329.3,206.3L327.2,207.9L328.9,209.1L332.2,210.1L334.8,211.3L333.2,212.8L331.1,214.2Z","M291.9,261.6L293.3,261.7L294.1,262.3L293.6,263.2L292.3,263.7L291.6,265.0L291.6,267.0L290.8,268.0L289.0,268.0L287.5,267.1L286.6,265.6L286.9,264.2L286.9,263.2L285.6,262.4L284.2,262.9L280.0,262.5L278.5,260.9L277.9,258.8L278.1,257.8L279.1,257.4L281.3,255.4L282.7,256.5L284.1,257.0L284.7,258.5L285.5,260.0L286.8,261.1L288.2,261.8L289.7,262.0L290.9,261.6L291.9,261.6Z","M264.9,209.8L265.6,211.9L265.2,213.1L264.5,217.3L263.3,221.0L262.7,224.2L263.3,226.8L263.3,228.5L262.1,229.1L260.5,229.7L259.0,230.7L257.1,227.7L256.8,226.1L256.3,224.7L256.2,222.0L259.2,214.0L259.7,212.7L261.1,211.2L262.9,209.2L264.4,208.9L264.9,209.8Z","M302.0,131.4L303.6,134.2L304.3,135.6L303.6,136.8L301.1,137.7L293.8,135.3L292.3,133.1L295.1,129.7L298.3,128.4L300.2,129.4L302.0,131.4Z","M394.7,10.7L393.6,9.5L393.8,8.1L396.1,6.3L397.1,6.1L398.5,6.5L399.5,7.4L400.3,8.4L400.9,10.2L402.3,11.0L398.1,13.1L394.7,10.7Z","M603.9,299.2L594.4,310.6L593.0,313.0L591.8,316.4L591.0,320.3L590.7,324.1L590.9,327.8L592.5,335.6L592.4,337.5L591.7,339.5L591.8,343.6L593.5,346.7L596.8,348.7L600.7,349.4L599.0,350.2L597.5,350.3L596.2,350.7L595.2,351.4L596.6,353.9L597.3,357.2L596.8,360.0L593.8,361.7L593.6,362.9L594.0,364.4L594.8,365.8L595.1,367.2L593.9,368.4L590.7,370.2L587.2,374.3L587.1,375.8L587.3,379.3L586.7,380.7L586.1,381.8L585.7,383.4L585.4,386.6L584.6,388.1L584.9,389.6L585.8,390.9L586.2,392.2L585.5,393.4L582.6,396.2L579.4,400.6L577.1,402.4L576.4,403.4L576.7,404.5L572.9,407.8L571.7,409.0L570.3,412.0L568.8,418.2L565.1,423.6L564.3,425.9L564.4,428.2L565.3,430.9L566.1,432.0L567.2,433.2L567.2,434.8L566.7,436.7L564.8,439.5L564.4,441.3L564.2,444.5L562.6,452.7L559.4,461.3L555.4,481.5L552.9,486.5L547.4,518.9L545.1,532.3L544.0,534.7L540.4,539.5L539.1,542.0L538.0,545.1L537.3,550.9L537.4,556.0L536.9,560.9L534.4,566.0L533.4,567.0L531.0,568.8L529.9,569.9L529.4,571.1L528.5,574.0L526.1,578.3L524.6,584.9L523.6,587.9L518.4,595.4L517.7,596.8L510.7,602.8L509.1,604.7L508.8,606.1L509.2,609.3L509.1,610.7L508.5,612.3L507.4,614.1L505.0,617.2L502.6,619.4L494.5,624.9L489.0,630.9L487.7,631.7L486.7,633.1L484.0,639.9L482.7,642.5L478.7,647.6L477.0,650.6L476.1,656.9L473.7,665.4L468.8,673.9L468.2,676.8L467.3,685.1L467.4,692.5L467.9,718.9L467.1,722.7L465.8,725.7L464.1,727.0L462.1,728.8L462.2,733.1L462.9,737.8L462.7,740.8L460.4,737.4L457.0,734.7L453.1,732.9L449.1,731.9L448.9,735.3L447.8,736.5L446.0,736.1L444.2,734.5L444.1,733.3L444.7,729.7L441.9,725.0L441.7,723.7L441.7,722.7L441.9,721.0L441.9,715.5L442.2,713.9L443.4,712.1L443.7,710.6L433.7,684.2L432.9,682.8L430.1,679.3L427.9,674.2L426.9,672.8L422.8,669.5L421.1,668.6L420.0,668.0L419.6,666.1L417.0,664.0L412.0,661.5L409.7,659.9L407.3,657.8L406.2,657.1L404.7,656.4L402.9,656.8L401.9,656.8L395.3,651.6L389.2,642.9L395.6,650.7L394.9,647.0L393.8,645.0L392.9,643.3L390.3,640.2L385.7,636.0L384.0,633.8L383.1,631.4L384.2,629.1L384.8,627.0L384.0,624.1L382.7,621.2L380.2,617.3L377.9,612.1L377.4,609.8L377.4,608.3L378.2,606.5L378.4,605.2L377.4,604.1L376.5,602.3L375.1,599.8L374.7,598.8L373.6,591.9L373.1,588.7L372.2,586.9L370.2,584.9L372.6,583.1L374.0,580.1L373.4,577.4L370.2,576.9L369.6,577.9L369.1,579.6L368.2,581.0L366.5,580.9L365.9,579.8L366.1,576.2L365.7,575.0L363.7,574.1L362.5,575.1L361.6,576.6L360.2,576.9L358.7,575.7L358.4,573.9L358.7,572.2L359.3,571.0L360.8,570.2L362.6,570.0L364.2,569.5L364.7,567.9L364.0,567.1L359.3,566.0L363.2,564.9L362.8,563.6L360.7,561.7L359.3,560.1L359.6,558.1L360.9,557.4L362.3,556.9L362.9,555.6L362.5,553.6L361.8,552.0L362.3,550.5L363.0,548.6L364.1,547.3L363.9,546.1L364.1,545.0L365.8,540.4L366.6,539.6L367.9,539.2L366.0,538.0L366.8,535.9L368.8,535.8L370.4,535.0L370.7,533.7L369.6,534.5L368.7,534.2L367.4,534.2L367.4,532.5L368.7,529.7L370.5,529.5L373.2,529.6L371.4,524.3L369.3,520.2L370.2,518.4L368.7,516.6L369.8,514.7L370.2,513.4L372.3,510.7L368.0,511.0L367.9,506.6L370.2,504.0L370.1,495.7L370.4,489.5L371.8,484.5L374.0,480.7L374.7,475.6L375.8,471.2L376.5,469.7L379.6,465.5L380.1,464.2L383.3,461.2L384.1,459.7L384.9,456.1L385.5,454.6L389.1,451.2L390.1,449.8L391.5,445.9L393.6,442.0L396.5,433.8L397.8,431.5L399.3,430.0L400.6,429.1L401.7,428.6L402.5,427.9L402.8,426.4L403.4,425.0L406.0,422.9L406.6,421.4L406.9,416.3L407.3,414.9L408.7,413.6L414.4,407.0L415.1,404.9L416.7,403.6L417.9,400.3L419.2,394.1L423.9,386.0L425.3,381.0L427.0,378.3L433.7,370.9L437.4,366.8L438.3,364.8L438.7,361.5L439.9,358.7L442.8,353.5L443.6,350.3L444.4,349.0L447.8,348.0L448.8,346.9L449.4,345.6L450.0,344.4L452.2,342.2L454.5,340.5L457.3,339.7L460.9,340.4L460.4,337.7L461.8,335.8L463.7,333.9L464.6,331.1L465.0,330.1L466.8,329.2L467.6,326.5L470.4,320.8L471.5,319.3L471.8,317.7L470.9,315.7L471.7,314.2L472.6,313.3L473.4,312.1L473.7,310.2L474.1,308.7L475.1,307.3L476.5,306.2L477.7,305.8L478.0,303.7L479.1,300.6L480.1,299.0L484.6,291.9L488.1,287.8L491.7,284.7L501.0,281.7L503.2,280.3L505.0,278.7L507.3,277.5L511.8,275.9L521.9,274.1L527.6,273.1L530.0,272.1L533.1,269.6L534.0,269.1L535.2,268.9L536.7,268.9L538.5,269.5L539.4,270.8L540.0,272.1L540.8,272.9L542.6,272.2L540.8,269.4L537.8,266.4L536.3,265.5L536.7,264.1L537.7,263.4L538.6,262.9L540.1,259.9L541.7,257.0L545.0,254.0L549.8,251.6L555.4,250.3L560.8,251.0L563.1,252.6L568.1,259.7L569.9,263.4L571.9,262.8L573.4,262.6L574.5,262.9L573.9,264.0L573.4,264.9L573.5,266.0L575.9,267.9L577.1,269.3L579.0,270.0L602.1,275.5L603.8,276.5L602.9,278.4L602.7,279.8L603.1,282.4L604.3,286.8L605.6,288.8L606.7,289.3L610.2,288.8L612.0,288.9L614.2,289.5L616.0,290.5L617.0,291.7L606.6,296.8L603.9,299.2Z","M558.5,720.5L560.8,722.3L561.9,723.6L561.7,725.0L559.0,725.9L555.3,724.4L551.8,721.9L549.9,720.0L550.5,718.7L550.4,717.3L549.9,716.2L549.0,715.1L558.9,715.1L558.7,716.5L558.2,717.8L558.1,719.2L558.5,720.5Z","M138.7,361.2L142.5,360.4L146.0,363.7L148.4,370.0L147.9,374.4L145.9,376.8L142.5,374.6L140.0,373.8L135.9,374.2L132.3,376.5L130.3,379.5L128.6,380.4L126.7,379.4L125.3,379.3L124.1,378.8L123.5,377.8L124.8,376.0L125.3,374.3L125.2,373.1L124.8,370.9L124.0,368.8L123.9,367.8L128.4,365.5L133.5,368.8L137.0,368.3L137.5,363.9L138.7,361.2Z","M304.8,494.5L307.1,498.9L307.8,500.9L307.5,502.4L306.5,501.4L305.2,500.6L303.8,500.3L301.8,501.4L300.4,501.6L299.3,502.7L298.8,504.8L296.1,506.8L293.7,507.1L291.2,506.2L288.8,503.7L289.4,502.4L290.8,504.1L292.8,504.5L294.9,503.9L296.7,502.4L295.5,502.0L294.5,501.4L293.7,500.6L293.0,499.4L292.1,500.4L292.0,498.4L292.1,496.4L294.1,496.7L297.8,494.3L300.2,493.5L299.5,495.7L301.3,495.8L302.8,495.9L304.0,495.9L304.8,494.5Z","M282.1,494.5L283.8,489.3L285.4,487.7L287.5,489.5L286.2,490.3L285.3,492.1L284.0,496.4L283.9,497.5L284.2,498.5L282.6,499.4L281.5,499.5L280.0,499.9L277.6,500.4L277.9,499.4L279.4,498.5L280.7,498.4L281.8,497.9L282.1,496.9L282.1,494.5Z","M294.8,491.0L294.4,489.2L293.4,487.8L291.2,485.6L294.0,483.5L295.6,484.4L297.2,485.8L297.9,487.3L296.7,488.5L297.2,490.2L296.5,491.4L295.4,491.7Z","M544.9,631.4L544.2,629.3L549.5,628.6L550.5,629.9L550.1,631.9L549.4,633.6L549.6,635.0L548.3,634.9L546.3,633.9L544.9,631.4Z","M354.3,516.5L361.3,509.4L366.7,502.6L367.9,502.2L363.4,509.6L361.1,511.8L359.7,513.7L357.8,515.6L356.3,516.6L354.0,518.4L352.4,519.3L354.3,516.5Z"];
const project=([lat,lng]:GeoPoint):GeoPoint=>[60+(lng-117.8)*132.46,60+(26.6-lat)*145];
const LABELS:Record<string,GeoPoint>={
  Matsu:[410,118],Kinmen:[140,340],Penghu:[190,495],
  Keelung:[648,208],
  Taipei:[636,252],Taoyuan:[471,250],Hsinchu:[370,300],Miaoli:[355,347],
  Taichung:[332,393],Changhua:[326,434],Nantou:[535,465],Yunlin:[300,474],
  Chiayi:[325,537],Tainan:[282,585],Kaohsiung:[285,631],Pingtung:[491,657],
  Yilan:[656,326],Hualien:[648,439],Taitung:[592,598]
};
function animatedVehicle(step:TripStep,fraction:number) {
  if(step.transport!=="ferry")return VEHICLES[step.transport];
  const p=illustrativePath(step), lengths=p.slice(1).map((q,i)=>pointDistance(p[i],q));
  const total=lengths.reduce((a,b)=>a+b,0);
  const transfer=CITIES[step.from].island ? fraction>1-lengths[lengths.length-1]/total : fraction<lengths[0]/total;
  return transfer ? "🚌" : "⛴️";
}
// SVG aircraft points north at 0°. Use the same map projection as its position.
function flightHeading(path:GeoPoint[],fraction:number) {
  const before=project(pointAlong(path,Math.max(0,fraction-0.002)));
  const after=project(pointAlong(path,Math.min(1,fraction+0.002)));
  return Math.atan2(after[1]-before[1],after[0]-before[0])*180/Math.PI+90;
}

type VehicleShape={d:string;fill:string;stroke?:string};
const VEHICLE_SHAPES:Record<string,VehicleShape[]>={
 plane:[
 {d:"M0 -20 C-3 -20 -4 -15 -4 -10 L-4 -5 L-18 4 L-18 8 L-4 4 L-3 12 L-9 16 L-9 19 L0 16 L9 19 L9 16 L3 12 L4 4 L18 8 L18 4 L4 -5 L4 -10 C4 -15 3 -20 0 -20 Z",fill:"#fff",stroke:"#2563eb"},
 {d:"M-2 -13 Q0 -16 2 -13 L2 -9 L-2 -9 Z",fill:"#38bdf8"}],
 bus:[
 {d:"M-20 8 V-10 Q-20 -14 -16 -14 H13 Q18 -14 20 -6 V8 Z",fill:"#fbbf24",stroke:"#92400e"},
 {d:"M-16 -10 H-8 V-3 H-16 Z M-5 -10 H3 V-3 H-5 Z M7 -10 H13 L16 -3 H7 Z",fill:"#bae6fd",stroke:"#0369a1"},
 {d:"M8 0 H15 V7 H8 Z",fill:"#fff7cc"},
 {d:"M-9 9 a4 4 0 1 0 -8 0 a4 4 0 1 0 8 0 M16 9 a4 4 0 1 0 -8 0 a4 4 0 1 0 8 0",fill:"#1e293b"}],
 ferry:[
 {d:"M-15 2 V-9 H10 L15 2 Z",fill:"#fff",stroke:"#0369a1"},
 {d:"M-9 -10 V-16 H-3 V-10 Z",fill:"#f97316",stroke:"#9a3412"},
 {d:"M-20 2 H21 L12 13 H-13 Z",fill:"#38bdf8",stroke:"#0369a1"},
 {d:"M-11 -6 H-6 V-2 H-11 Z M-3 -6 H2 V-2 H-3 Z M5 -6 H10 V-2 H5 Z",fill:"#164e63"}],
 car:[
 {d:"M-20 7 V0 L-12 -3 L-7 -12 H8 L14 -3 L20 0 V7 Z",fill:"#fb7185",stroke:"#9f1239"},
 {d:"M-9 -4 L-5 -9 H0 V-4 Z M3 -9 H7 L11 -4 H3 Z",fill:"#bae6fd"},
 {d:"M-8 8 a4 4 0 1 0 -8 0 a4 4 0 1 0 8 0 M16 8 a4 4 0 1 0 -8 0 a4 4 0 1 0 8 0",fill:"#1e293b"}],
 train:[
 {d:"M-20 7 V-13 H10 Q18 -13 20 -3 V7 Z",fill:"#34d399",stroke:"#065f46"},
 {d:"M-16 -9 H-9 V-3 H-16 Z M-6 -9 H1 V-3 H-6 Z M8 -9 H12 L16 -3 H8 Z",fill:"#e0f2fe"},
 {d:"M-20 3 H19",fill:"none",stroke:"#fff"},
 {d:"M-8 10 a3 3 0 1 0 -6 0 a3 3 0 1 0 6 0 M15 10 a3 3 0 1 0 -6 0 a3 3 0 1 0 6 0",fill:"#1e293b"}],
 hsr:[
 {d:"M-21 8 V-12 H1 Q10 -12 21 5 L21 8 Z",fill:"#fff",stroke:"#475569"},
 {d:"M-17 -8 H-10 V-3 H-17 Z M-7 -8 H0 V-3 H-7 Z M5 -8 L14 1 H5 Z",fill:"#38bdf8"},
 {d:"M-20 4 H17",fill:"none",stroke:"#f97316"},
 {d:"M-9 10 a3 3 0 1 0 -6 0 a3 3 0 1 0 6 0 M13 10 a3 3 0 1 0 -6 0 a3 3 0 1 0 6 0",fill:"#1e293b"}],
 bike:[
 {d:"M-5 8 a7 7 0 1 0 -14 0 a7 7 0 1 0 14 0 M20 8 a7 7 0 1 0 -14 0 a7 7 0 1 0 14 0",fill:"#fff",stroke:"#334155"},
 {d:"M-12 8 L-5 -5 L2 8 H-12 M-5 -5 H9 L2 8 M9 -5 L13 8 M9 -5 L7 -11 H13 M-9 -8 H-2",fill:"none",stroke:"#7c3aed"}],
 foot:[
 {d:"M8 -14 a5 5 0 1 0 -10 0 a5 5 0 1 0 10 0",fill:"#fed7aa",stroke:"#9a3412"},
 {d:"M-2 -7 L6 -5 L2 5 L-6 2 Z",fill:"#60a5fa",stroke:"#1d4ed8"},
 {d:"M3 -3 L10 2 L16 0 M-1 -3 L-10 2 M-2 4 L-8 14 H-14 M0 5 L7 14 H13",fill:"none",stroke:"#334155"}]
};
// Side-view artwork faces right and stays upright. Mirror for westbound travel;
// only the aircraft rotates. Share this rule with the downloadable video.
const sideFacing=(heading:number)=>Math.sin(heading*Math.PI/180)<-0.000001?-1:1;
const movingMode=(step:TripStep,f:number)=>step.transport==="ferry"&&animatedVehicle(step,f)==="🚌"?"bus":step.transport;
function VehicleGlyph({mode,heading}:{mode:string;heading:number}){
 return VEHICLE_SHAPES[mode]?<g transform={mode==="plane"?"rotate("+heading+")":"scale("+sideFacing(heading)+",1)"} data-oriented-vehicle={mode}>
 {VEHICLE_SHAPES[mode].map((p,i)=><path key={i} d={p.d} fill={p.fill} stroke={p.stroke??"none"} strokeWidth="1.6" strokeLinejoin="round"/>)}
 </g>:<text textAnchor="middle" dominantBaseline="central" fontSize="30">{VEHICLES[mode]}</text>;
}
function joinBytes(parts:Uint8Array[]){
 const out=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;
 for(const p of parts){out.set(p,offset);offset+=p.length;}return out;
}
function uintBytes(value:number){
 const bytes:number[]=[];do{bytes.unshift(value%256);value=Math.floor(value/256);}while(value>0);
 return new Uint8Array(bytes);
}
function ebml(id:number,body:Uint8Array){
 let nBytes=1;while(body.length>=Math.pow(2,7*nBytes)-1)nBytes++;
 const size=new Uint8Array(nBytes);let n=body.length;
 for(let i=nBytes-1;i>=0;i--){size[i]=n%256;n=Math.floor(n/256);}size[0]|=1<<(8-nBytes);
 return joinBytes([uintBytes(id),size,body]);
}
const ebmlNumber=(id:number,n:number)=>ebml(id,uintBytes(n));
const ebmlText=(id:number,s:string)=>ebml(id,new TextEncoder().encode(s));
// WebM / VP8 keyframes, explicit timestamps and duration; no screen recording.
// Specs: matroska.org/technical/elements.html and developers.google.com/speed/webp/docs/riff_container
function webmFromFrames(frames:Uint8Array[],fps:number,width:number,height:number){
 const duration=new Uint8Array(8);new DataView(duration.buffer).setFloat64(0,frames.length*1000/fps);
 const header=ebml(0x1a45dfa3,joinBytes([ebmlNumber(0x4286,1),ebmlNumber(0x42f7,1),ebmlNumber(0x42f2,4),ebmlNumber(0x42f3,8),ebmlText(0x4282,"webm"),ebmlNumber(0x4287,2),ebmlNumber(0x4285,2)]));
 const info=ebml(0x1549a966,joinBytes([ebmlNumber(0x2ad7b1,1000000),ebmlText(0x4d80,"Taiwan Trip"),ebmlText(0x5741,"Taiwan Trip"),ebml(0x4489,duration)]));
 const tracks=ebml(0x1654ae6b,ebml(0xae,joinBytes([ebmlNumber(0xd7,1),ebmlNumber(0x73c5,1),ebmlNumber(0x83,1),ebmlNumber(0x9c,0),ebmlText(0x86,"V_VP8"),ebmlNumber(0x23e383,Math.round(1e9/fps)),ebml(0xe0,joinBytes([ebmlNumber(0xb0,width),ebmlNumber(0xba,height)]))])));
 const clusters:Uint8Array[]=[];const perCluster=30*fps;
 for(let first=0;first<frames.length;first+=perCluster){
  const blocks=[ebmlNumber(0xe7,Math.round(first*1000/fps))];
  for(let i=first;i<Math.min(frames.length,first+perCluster);i++){
   const ms=Math.round(i*1000/fps)-Math.round(first*1000/fps);
   blocks.push(ebml(0xa3,joinBytes([new Uint8Array([0x81,(ms>>8)&255,ms&255,0x80]),frames[i]])));
  }
  clusters.push(ebml(0x1f43b675,joinBytes(blocks)));
 }
 return new Blob([joinBytes([header,ebml(0x18538067,joinBytes([info,tracks,...clusters]))]).buffer],{type:"video/webm"});
}
async function encodeVP8(canvas:HTMLCanvasElement){
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("影格編碼失敗。")),"image/webp",0.82));
 if(blob.type!=="image/webp")throw new Error("請使用桌面 Chrome 或 Edge 匯出影片。");
 const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
 for(let pos=12;pos+8<=bytes.length;){
  const tag=String.fromCharCode(...bytes.slice(pos,pos+4)),size=view.getUint32(pos+4,true);
  if(pos+8+size>bytes.length)break;if(tag==="VP8 ")return bytes.slice(pos+8,pos+8+size);
  pos+=8+size+(size%2);
 }
 throw new Error("無法編碼 VP8 影格，請換瀏覽器。");
}
function loadSvgImage(svg:string):Promise<HTMLImageElement>{
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"})),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("地圖影像載入失敗。"));};img.src=url;
 });
}
function TripVideoExporter({steps,teamName,mapRef}:{steps:TripStep[];teamName:string;mapRef:React.RefObject<SVGSVGElement|null>}){
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState("");
 const [url,setUrl]=useState("");
 const stopped=useRef(false),running=useRef(false),savedUrl=useRef("");
 useEffect(()=>()=>{stopped.current=true;if(savedUrl.current)URL.revokeObjectURL(savedUrl.current);},[]);
 async function create(){
  if(running.current||!mapRef.current)return;
  running.current=true;stopped.current=false;setBusy(true);setProgress(0);setError("");
  if(savedUrl.current)URL.revokeObjectURL(savedUrl.current);savedUrl.current="";setUrl("");
  try{
   const clone=mapRef.current.cloneNode(true) as SVGSVGElement;
   clone.removeAttribute("style");clone.setAttribute("width","760");clone.setAttribute("height","810");clone.setAttribute("font-family","Arial, sans-serif");
   clone.querySelectorAll("[data-moving-vehicle]").forEach(n=>n.remove());
   clone.querySelectorAll("polyline").forEach(n=>{n.setAttribute("opacity","0.9");n.setAttribute("stroke-width","4");});
   const base=await loadSvgImage(new XMLSerializer().serializeToString(clone));
   const canvas=document.createElement("canvas");canvas.width=1280;canvas.height=720;
   const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas unavailable");
   const paths=steps.map(illustrativePath),fps=12,duration=steps.length*6,frames:Uint8Array[]=[];
   const scale=640/760;
   for(let frame=0;frame<(duration+2)*fps;frame++){
    if(stopped.current)return;
    const time=frame/fps,day=Math.min(steps.length-1,Math.floor(time/6)),fraction=time>=duration?1:Math.min(1,(time%6)/5);
    ctx.fillStyle="#eff6ff";ctx.fillRect(0,0,1280,720);ctx.drawImage(base,0,18,640,810*scale);
    if(time<duration){
     const [x,y]=project(pointAlong(paths[day],fraction)),mode=movingMode(steps[day],fraction);
     ctx.save();ctx.translate(x*scale,18+y*scale);ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);
     ctx.fillStyle="#fff";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=ROUTE_COLORS[day];ctx.stroke();
     if(VEHICLE_SHAPES[mode]){
      const heading=flightHeading(paths[day],fraction);
      if(mode==="plane")ctx.rotate(heading*Math.PI/180);
      else ctx.scale(sideFacing(heading),1);
      for(const shape of VEHICLE_SHAPES[mode]){const p=new Path2D(shape.d);ctx.fillStyle=shape.fill;ctx.fill(p);if(shape.stroke){ctx.strokeStyle=shape.stroke;ctx.lineWidth=1.6;ctx.stroke(p);}}
     }else{ctx.font="30px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(VEHICLES[mode],0,0);}
     ctx.restore();
    }
    ctx.fillStyle="#0f172a";ctx.font="bold 34px Arial";ctx.fillText("Our Own Trip",675,58);
    ctx.font="22px Arial";ctx.fillText("Team: "+teamName,675,94,570);
    ctx.font="bold 20px Arial";ctx.fillStyle="#047857";ctx.fillText(time>=duration?"Trip Complete!":"Day "+(day+1)+" · Follow our journey!",675,132);
    steps.forEach((step,i)=>{
     const y=152+i*110;ctx.fillStyle=i===day?"#dbeafe":"#fff";ctx.fillRect(665,y,595,104);
     ctx.fillStyle=ROUTE_COLORS[i];ctx.font="bold 19px Arial";ctx.fillText("Day "+(i+1)+": "+step.from+" → "+step.to,680,y+25);
     ctx.fillStyle="#1e293b";ctx.font="20px Arial";let line="",lineY=y+51;
     const sentence=SEQUENCE_ADVERBS[i]+", we go "+(i===3?"back ":"")+"to "+step.to+" "+TRANSPORT_DATA[step.transport].label.toLowerCase()+".";
     for(const word of sentence.split(" ")){if(ctx.measureText(line+word).width>545){ctx.fillText(line,680,lineY);line="";lineY+=24;}line+=word+" ";}ctx.fillText(line,680,lineY);
     if(isMatsuFerry(step.from,step.to,step.transport)){ctx.fillStyle="#b91c1c";ctx.font="bold 16px Arial";ctx.fillText("Ferry operating time: about 8–10 hours",680,y+96);}
    });
    ctx.fillStyle="#047857";ctx.font="bold 25px Arial";ctx.fillText("Total carbon: "+steps.reduce((sum,s)=>sum+s.carbon,0).toLocaleString()+" g CO₂",675,643);
    ctx.fillStyle="#475569";ctx.font="15px Arial";ctx.fillText("Classroom estimates · Illustrative routes · No audio",675,688);
    frames.push(await encodeVP8(canvas));
    if(frame%4===0){setProgress(Math.floor((frame+1)/((duration+2)*fps)*100));await new Promise(resolve=>window.setTimeout(resolve,0));}
   }
   if(stopped.current)return;
   const result=URL.createObjectURL(webmFromFrames(frames,fps,1280,720));savedUrl.current=result;setUrl(result);setProgress(100);
  }catch(e){if(!stopped.current)setError(e instanceof Error?e.message:"影片匯出失敗。");}
  finally{running.current=false;setBusy(false);}
 }
 const button="rounded-xl px-4 py-3 font-bold border-2 border-blue-300 bg-white text-blue-900";
 return <div className="space-y-3">
  <div className="flex flex-wrap gap-3">
   <button className={button} disabled={busy} onClick={create}>{busy?"Preparing video… "+progress+"%":"🎬 Create Trip Video"}</button>
   {busy&&<button className={button} onClick={()=>{stopped.current=true;}}>Cancel export</button>}
   {url&&<a className={button} href={url} download={"Our_Own_Trip_"+(teamName.replace(/[^a-zA-Z0-9_-]/g,"_")||"Team")+".webm"}>⬇ Download Video (WebM)</a>}
  </div>
  <p className="text-sm text-slate-600">製作 26 秒、1280 × 720 的無聲 WebM 影片，包含四天路線、交通動畫、英文句子與總碳排。按 Create Trip Video，完成後按 Download Video。建議用桌面 Chrome 或 Edge。</p>
  {error&&<p role="alert" style={{color:"#b91c1c",fontWeight:800}}>{error}</p>}
 </div>;
}

function TripMap({steps,teamName}:{steps:TripStep[];teamName:string}) {
  const svgRef=useRef<SVGSVGElement>(null);
  const [clock,setClock]=useState(0),[playing,setPlaying]=useState(false);
  const [enlarged,setEnlarged]=useState(false);
  const viewport=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(viewport.current)viewport.current.scrollLeft=enlarged?(viewport.current.scrollWidth-viewport.current.clientWidth)*0.7:0;
  },[enlarged]);
  const paths=useMemo(()=>steps.map(illustrativePath),[steps]);
  const leg=Math.min(steps.length-1,Math.floor(clock/6));
  const duration=steps.length*6;
  const arrived=clock%6>=5 || clock>=duration;
  const fraction=clock>=duration?1:Math.min(1,(clock%6)/5);
  const sentence=(i:number)=>SEQUENCE_ADVERBS[i]+", we go "+(i===3?"back ":"")+"to "+steps[i].to+" "+TRANSPORT_DATA[steps[i].transport].label.toLowerCase()+".";
  useEffect(()=>{
    if(!playing)return;
    let frame=0,previous=0;
    const tick=(now:number)=>{
      const delta=!previous||document.hidden?0:Math.min((now-previous)/1000,0.1);
      previous=now;
      setClock(value=>Math.min(duration,value+delta));
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[playing,duration]);
  useEffect(()=>{if(clock>=duration)setPlaying(false);},[clock,duration]);
  const [vx,vy]=project(pointAlong(paths[leg],fraction));
  const heading=flightHeading(paths[leg],fraction);
  const buttonStyle="rounded-xl px-4 py-3 font-bold border-2 border-slate-300 bg-white text-slate-800 focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-500";
  return <section className="bg-blue-50 p-3 md:p-6 space-y-4" aria-label="Taiwan travel map">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-2xl font-black">Our Taiwan Trip</h3>
      <div className="flex flex-wrap gap-2">
        <button className={buttonStyle} onClick={()=>{if(clock>=duration)setClock(0);setPlaying(!playing);}}>{playing?"⏸ Pause":"▶ Play My Trip"}</button>
        <button className={buttonStyle} onClick={()=>{setClock(0);setPlaying(true);}}>↺ Replay</button>
        <button className={buttonStyle} onClick={()=>{setPlaying(false);setClock(duration);setEnlarged(false);}}>▣ Full Trip</button>
        <button className={buttonStyle} onClick={()=>setEnlarged(v=>!v)}>{enlarged?"⊡ Fit Map":"🔎 Enlarge Map"}</button>
      </div>
    </div>
    <TripVideoExporter steps={steps} teamName={teamName} mapRef={svgRef}/>
    <p className="text-sm text-slate-600">Find the places. Follow our trip! 小螢幕可按 Enlarge Map 放大閱讀，左右滑動看地名。</p>
    <div ref={viewport} className="overflow-x-auto rounded-2xl border-2 border-sky-200 bg-[#a9dfed]" tabIndex={0} aria-label="Taiwan map viewport">
      <svg ref={svgRef} viewBox="0 0 760 810" style={{width:"100%",minWidth:enlarged?680:0,display:"block"}} role="img" aria-label={"Taiwan, Penghu, Kinmen and Matsu. Route: "+steps.map(s=>s.from+" to "+s.to).join(", ")}>
        <rect width="760" height="810" fill="#a9dfed"/>
        <g fill="#d6ebcd" stroke="#88b79a" strokeWidth="1.2">{LAND_PATHS.map((d,i)=><path key={i} d={d}/>)}</g>
        <text x="34" y="46" fill="#23586a" fontSize="23" fontWeight="800">TAIWAN • ISLAND ADVENTURE</text>
        <text x="187" y="670" fill="#387e92" fontSize="19" transform="rotate(-65 187 670)">Taiwan Strait</text>
        <text x="515" y="529" fill="#4f8667" fontSize="28" fontWeight="900" transform="rotate(-65 515 529)">TAIWAN</text>
        <g transform="translate(696 66)" fill="#23586a"><text textAnchor="middle" y="-12" fontWeight="bold">N</text><path d="M0,0 L-7,23 L0,18 L7,23 Z"/></g>
        {paths.map((p,i)=><polyline key={i} points={p.map(q=>project(q).join(",")).join(" ")}
          fill="none" stroke={ROUTE_COLORS[i]} strokeWidth={i===leg?5:3.5} strokeDasharray="8 5"
          strokeLinejoin="round" strokeLinecap="round" opacity={clock>=duration||i===leg?0.95:0.45}/>)}
        {Object.values(CITIES).map(city=>{
          const [x,y]=project([city.lat,city.lng]),[lx,ly]=LABELS[city.name];
          const stop=steps.slice(0,3).findIndex(s=>s.to===city.name)+1;
          const selected=stop>0||city.name==="Taipei";
          const visited=city.name==="Taipei"||stop>0&&clock>=stop*6-1;
          const label=(city.name==="Taipei"?"⚑ ":stop?stop+". ":"")+city.name;
          const width=label.length*8.4+20;
          return <g key={city.name}>
            <title>{city.name+(selected?" · Our stop":"")}</title>
            <line x1={x} y1={y} x2={lx} y2={ly} stroke={selected?"#334155":"#78909c"} strokeWidth={selected?1.8:1}/>
            <circle cx={x} cy={y} r={selected?8:4.5} fill={selected?(visited?"#16a34a":"#f59e0b"):"#fff"} stroke="#234b57" strokeWidth="2"/>
            <rect x={lx-width/2} y={ly-14} width={width} height="28" rx="9" fill={selected?"#fff7d6":"#ffffff"} stroke={selected?"#d69b24":"#b6cdd1"}/>
            <text x={lx} y={ly+5} textAnchor="middle" fontSize="16" fontWeight={selected?900:600} fill="#173e4b">{label}</text>
          </g>;
        })}
        {clock<duration&&<g data-moving-vehicle="true" transform={"translate("+vx+" "+vy+")"} aria-hidden="true" pointerEvents="none">
          <circle r="24" fill="white" stroke={ROUTE_COLORS[leg]} strokeWidth="3"/>
          <VehicleGlyph mode={movingMode(steps[leg],fraction)} heading={heading}/>
        </g>}
        <rect x="24" y="742" width="710" height="47" rx="13" fill="white" opacity=".92"/>
        <text x="40" y="763" fontSize="14" fill="#355b68">● All places   ⚑ Start / Finish   1–3 Our stops   ┄ Travel route</text>
        <text x="40" y="781" fontSize="12" fill="#57777f">Made with Natural Earth · Travel paths are classroom illustrations, not navigation.</text>
      </svg>
    </div>
    <div className="rounded-xl bg-white border-l-8 p-4" style={{borderColor:ROUTE_COLORS[leg]}}>
      <p className="font-black text-lg text-blue-800" aria-live="polite">{clock>=duration?"✓ Trip Complete!":arrived?"✓ Arrived in "+steps[leg].to:"Day "+(leg+1)+" · "+steps[leg].from+" → "+steps[leg].to}</p>
      <p className="text-xl font-bold mt-2">{VEHICLES[steps[leg].transport]} {sentence(leg)}</p>
      {steps[leg].routeName&&<p className="text-sm font-bold text-indigo-700 mt-1">🛣️ {steps[leg].routeName}</p>}
      {steps[leg].routeWarning&&<p className="text-sm font-bold text-amber-700 mt-1">⚠ {steps[leg].routeWarning}</p>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {steps.map((step,i)=><button key={i} onClick={()=>{setPlaying(false);setClock(i*6);}} className={buttonStyle+" text-left"} style={{borderColor:ROUTE_COLORS[i]}}>
        <p>Day {i+1} · {VEHICLES[step.transport]} {step.from} → {step.to}</p>
        <p className="text-sm mt-1">{isMatsuFerry(step.from,step.to,step.transport)?"8–10 h":"About "+hoursText(step.hours)} · {step.distance} km · {step.carbon.toLocaleString()} g CO₂</p>
        {step.routeName&&<p className="text-xs mt-1 font-bold text-indigo-700">🛣️ {step.routeName}</p>}
        {step.routeWarning&&<p className="text-xs mt-1 font-bold text-amber-700">⚠ {step.routeWarning}</p>}
        {isMatsuFerry(step.from,step.to,step.transport)&&<p style={{color:"#b91c1c",fontWeight:800}}>⚠ {FERRY_WARNING}</p>}
      </button>)}
    </div>
    <p className="text-sm text-slate-600">Padlet：按 Full Trip 顯示完整路線，再擷取地圖與英文句子。渡輪的港口接駁段會顯示公車；路線與時間是課堂估算。</p>
  </section>;
}

export default function App() {
  const [teamName, setTeamName] = useState("");
  const [places, setPlaces] = useState<string[]>([]); 
  const [itinerary, setItinerary] = useState<(string | null)[]>([null, null, null, null]);
  const [stage, setStage] = useState("plan");
  
  const [englishAnswers, setEnglishAnswers] = useState([
    { dest: "", trans: "" }, { dest: "", trans: "" }, { dest: "", trans: "" }, { dest: "Taipei", trans: "" }
  ]);
  const [englishResult, setEnglishResult] = useState<"correct" | "wrong" | null>(null);
  const [readAloud, setReadAloud] = useState(false);

  const getRouteInfo = (index: number) => {
    const fromCity = index === 0 ? "Taipei" : places[index - 1];
    const toCity = index === MAX_PLACES ? "Taipei" : places[index];
    if (!fromCity || !toCity) return null;
    
    const from = CITIES[fromCity];
    const to = CITIES[toCity];
    const distance = Math.round(calculateDistance(from.lat, from.lng, to.lat, to.lng));
    return { from: fromCity, to: toCity, distance, fromData: from, toData: to };
  };

  const checkTransportAvailability = (routeInfo: ReturnType<typeof getRouteInfo>, transportId: string) =>
    routeInfo ? routeEstimate(routeInfo.from,routeInfo.to,transportId) : {disabled:true,reason:"Choose places first.",hours:0,routeName:"",routeWarning:""};


  const handlePlaceToggle = (place: string) => {
    if (places.includes(place)) {
      setPlaces(places.filter(p => p !== place));
      setItinerary([null, null, null, null]); 
    } else if (places.length < MAX_PLACES) {
      setPlaces([...places, place]);
    }
  };

  const updateTransport = (index: number, transId: string) => {
    const route=getRouteInfo(index);
    if(!route || routeEstimate(route.from,route.to,transId).disabled)return;
    const newItinerary = [...itinerary];
    newItinerary[index] = transId;
    setItinerary(newItinerary);
    setEnglishResult(null);
  };

  const resetAll = () => {
    setPlaces([]);
    setItinerary([null, null, null, null]);
    setStage("plan");
    setEnglishAnswers([{ dest: "", trans: "" }, { dest: "", trans: "" }, { dest: "", trans: "" }, { dest: "Taipei", trans: "" }]);
    setEnglishResult(null);
    setReadAloud(false);
  };

  const currentPlanDetails = useMemo(() => {
    if (places.length < MAX_PLACES) return { totalCarbon: 0, totalHours: 0, steps: [] };
    
    let total = 0;
    let totalHours = 0;
    const steps = [];
    
    for (let i = 0; i <= MAX_PLACES; i++) {
      const routeInfo = getRouteInfo(i);
      if (!routeInfo) continue;
      const transId = itinerary[i];
      let stepCarbon = 0;
      const estimate=transId?routeEstimate(routeInfo.from,routeInfo.to,transId):null;
      totalHours += estimate?.hours??0;
      
      if (routeInfo && transId) {
        stepCarbon = estimate!.carbon;
        total += stepCarbon;
      }
      
      steps.push({
        ...routeInfo,
        transport: transId,
        distance: estimate?.distance??routeInfo.distance,
        hours: estimate?.hours??0,
        carbon: stepCarbon,
        routeName: estimate?.routeName??"",
        routeWarning: estimate?.routeWarning??""
      });
    }
    return { totalCarbon: total, totalHours, steps };
  }, [places, itinerary]);

  const canContinue = teamName.trim() !== "" && places.length === MAX_PLACES && itinerary.every((t,i) => {
    const route=getRouteInfo(i);
    return !!t && !!route && !routeEstimate(route.from,route.to,t).disabled;
  });
  
  const getMissingInfo = () => {
    if (!teamName.trim()) return "Please enter your team name.";
    if (places.length < MAX_PLACES) return `Please select ${MAX_PLACES - places.length} more place(s).`;
    if (itinerary.includes(null)) return "Please choose transportation for every part of your trip.";
    return "";
  };

  const handleContinue = () => {
    if(!canContinue)return;
    setStage("english");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckEnglish = () => {
    let isCorrect = true;
    for (let i = 0; i <= MAX_PLACES; i++) {
      const step = currentPlanDetails.steps[i];
      const ans = englishAnswers[i];
      if (ans.dest !== step.to || ans.trans !== step.transport) {
        isCorrect = false;
        break;
      }
    }
    setEnglishResult(isCorrect ? 'correct' : 'wrong');
  };

  const openGoogleMaps = () => {
    const stops = [ "Taipei", ...places, "Taipei" ].map(encodeURIComponent);
    const url = `https://www.google.com/maps/dir/${stops.join('/')}`;
    window.open(url, '_blank');
  };

  const getFinalSentences = () => {
    return currentPlanDetails.steps.map((step, index) => {
      const transLabel = step.transport ? TRANSPORT_DATA[step.transport].label.toLowerCase() : "";
      return `${SEQUENCE_ADVERBS[index]}, we go ${index === 3 ? "back " : ""}to ${step.to} ${transLabel}.`;
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-2 sm:p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-[#EADAC5]">
        
        {/* Header & Progress */}
        <div className="bg-emerald-600 p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full -mr-20 -mt-20 opacity-50"></div>
          <h1 className="text-3xl md:text-4xl font-black mb-6 flex items-center justify-center gap-3 tracking-tight relative z-10">
            <Leaf className="w-8 h-8 md:w-10 md:h-10 text-emerald-200" /> {APP_TITLE}
          </h1>
          
          <div className="flex flex-wrap justify-center gap-2 md:gap-6 text-[10px] md:text-sm font-bold uppercase tracking-wider relative z-10">
            {[
              { id: 'plan', label: '1. Plan Route', done: stage !== 'plan' },
              { id: 'english', label: '2. English Check', done: stage === 'report' },
              { id: 'report', label: '3. Final Log', done: false }
            ].map(step => (
              <div key={step.id} className={`flex items-center gap-1.5 ${stage === step.id ? 'text-white' : step.done ? 'text-emerald-200' : 'text-emerald-800/50'}`}>
                {step.done ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : <div className={`w-2 h-2 rounded-full ${stage === step.id ? 'bg-white' : 'bg-emerald-800/50'}`}></div>}
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-10">
          
          {/* ================= STAGE 1: Plan ================= */}
          {stage === "plan" && (
            <div className="space-y-12 animate-in fade-in duration-500">

              {/* Basic Info */}
              <section className="space-y-3">
                <label className="text-lg md:text-xl font-bold flex items-center gap-2 text-slate-800">
                  <span className="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-base shadow-sm font-black">1</span>
                  What is your team name?
                  <span className="text-sm font-normal text-slate-500 ml-2">For example: Green Stars</span>
                </label>
                <input 
                  type="text" 
                  maxLength={20}
                  placeholder="e.g. Green Stars"
                  className="w-full md:w-1/2 p-4 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all text-lg font-bold disabled:bg-slate-50 disabled:text-slate-500"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </section>

              {/* Destinations */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-slate-800">
                    <span className="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-base shadow-sm font-black">2</span>
                    Choose 3 places to visit
                    <span className="text-sm font-normal text-slate-500 ml-2">4 days · Start and end at Taipei.</span>
                  </h2>
                  <span className={`font-black px-4 py-1.5 rounded-full text-sm ${places.length === MAX_PLACES ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    SELECTED: {places.length} / {MAX_PLACES}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3 bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200">
                  {DESTINATION_OPTIONS.map(dest => {
                    const isSelected = places.includes(dest);
                    const isDisabled = !isSelected && places.length >= MAX_PLACES;
                    return (
                      <button
                        key={dest}
                        disabled={isDisabled}
                        onClick={() => handlePlaceToggle(dest)}
                        className={`px-4 md:px-5 py-2.5 md:py-3 rounded-xl border-2 transition-all font-bold text-base md:text-lg ${
                          isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-md hover:bg-emerald-600'
                          : isDisabled
                            ? 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed opacity-60'
                            : 'bg-white border-slate-200 hover:border-emerald-400 hover:text-emerald-700 text-slate-600 shadow-sm'
                        }`}
                      >
                        {dest}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Transportation */}
              <section className="space-y-6">
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-slate-800">
                  <span className="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-base shadow-sm font-black">3</span>
                  Choose one main transport for each day
                </h2>
                
                <div className="space-y-6">
                  {places.length === MAX_PLACES && Array.from({ length: MAX_PLACES + 1 }).map((_, index) => {
                    const routeInfo = getRouteInfo(index);
                    if (!routeInfo) return null;
                    
                    return (
                      <div key={index} className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
                        <div className="p-4 md:p-6 flex-grow space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black uppercase text-emerald-700 px-3 py-1 bg-emerald-100 rounded-lg">
                                Day {index+1} · {SEQUENCE_ADVERBS[index]}
                              </span>
                              <div className="flex items-center gap-2 text-lg md:text-xl font-black text-slate-800">
                                <span>{routeInfo.from}</span>
                                <span className="text-slate-400 font-normal">→</span>
                                <span>{routeInfo.to}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-sm font-bold bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-100">
                              <MapPin className="w-4 h-4 text-emerald-500" />
                              Direct distance: {routeInfo.distance} km
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {Object.values(TRANSPORT_DATA).map((info) => {
                              const Icon = info.icon;
                              const active = itinerary[index] === info.id;
                              const { disabled, reason, hours, routeName, routeWarning } = checkTransportAvailability(routeInfo, info.id);
                              
                              return (
                                <button
                                  key={info.id}
                                  disabled={disabled}
                                  onClick={() => updateTransport(index, info.id)}
                                  className={`relative flex flex-col items-start justify-center gap-2 p-4 rounded-xl border-2 transition-all text-left group ${
                                    active 
                                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md z-10' 
                                    : disabled
                                      ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'
                                      : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 shadow-sm'
                                  }`}
                                >
                                  {active && (
                                    <div className="absolute top-2 right-2 bg-emerald-500 text-white p-0.5 rounded-full shadow-sm">
                                      <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div className={`flex items-center gap-2 ${active ? 'text-emerald-700' : disabled ? 'text-slate-400' : 'text-slate-700'}`}>
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-base font-bold">{info.label}</span>
                                  </div>
                                  <div className={`text-[13px] md:text-sm font-semibold ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {info.value} g CO₂/km · estimate
                                  </div>
                                  {!disabled&&(isMatsuFerry(routeInfo.from,routeInfo.to,info.id)?<p style={{color:"#b91c1c",fontWeight:800}}>⚠ {FERRY_WARNING}</p>:<p className="text-sm font-bold text-blue-700">About {hoursText(hours)}</p>)}
                                  {!disabled&&routeName&&<p className="text-xs font-bold text-indigo-700">🛣️ {routeName}</p>}
                                  {!disabled&&routeWarning&&<p className="text-xs font-bold text-amber-700">⚠ {routeWarning}</p>}
                                  {disabled && (
                                    <div className="text-xs text-slate-600 leading-relaxed">
                                      {reason || "Please choose a practical way."}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          
                          {itinerary[index] && (
                            <div className="flex justify-end pt-2">
                              <div className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md">
                                <Leaf className="w-4 h-4 text-emerald-400" />
                                Estimated carbon: <span className="font-black text-emerald-400 text-base">{currentPlanDetails.steps[index].carbon.toLocaleString()}</span> g CO₂
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {places.length===MAX_PLACES && <div className="rounded-2xl border-2 p-5 bg-sky-50 border-sky-200">
                <h3 className="font-black text-xl">⏰ Our 4-Day Trip</h3>
                <p className="font-bold mt-2">One route. One main transport. Each day.</p>
                <p className="text-sm mt-2">四天完成：每天一段路程、一種主要交通工具，第 4 天返回 Taipei。每天分別檢查交通是否合理，全程不設 12 小時上限。</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3" role="status">
                  {currentPlanDetails.steps.map((step,i)=><p key={i} className="bg-white rounded-lg p-3">
                    <strong>Day {i+1}: {step.from} → {step.to}</strong><br/>
                    {step.transport ? TRANSPORT_DATA[step.transport].label+" · "+(isMatsuFerry(step.from,step.to,step.transport)?"8–10 h":"About "+hoursText(step.hours)) : "Choose your transport."}
                    {step.transport&&step.routeName&&<span className="block text-xs font-bold text-indigo-700 mt-1">🛣️ {step.routeName}</span>}
                    {step.transport&&step.routeWarning&&<span className="block text-xs font-bold text-amber-700 mt-1">⚠ {step.routeWarning}</span>}
                    {step.transport&&isMatsuFerry(step.from,step.to,step.transport)&&<span style={{display:"block",color:"#b91c1c",fontWeight:800}}>⚠ {FERRY_WARNING}</span>}
                  </p>)}
                </div>
                <p className="text-sm mt-3">一般每段交通估計最多 {MAX_LEG_HOURS} 小時（基隆—馬祖渡輪例外），保留遊覽與休息時間。步行每天最多 30 km、單車每天最多 80 km，分日判斷，不累加限制四天總里程。</p>
                <p className="text-sm mt-2">航空：Matsu ↔ Taipei / Taichung / Kaohsiung；Penghu / Kinmen ↔ Taipei / Taichung / Chiayi / Tainan / Kaohsiung；Penghu ↔ Kinmen 亦可搭飛機。</p>
                <p className="text-sm mt-2">渡輪：Chiayi / Kaohsiung ↔ Penghu；Keelung（基隆港）↔ Matsu。基隆—馬祖渡輪特例開放，運行時間約 8 至 10 小時。金門在本活動中沒有渡輪連線。</p>
                <p className="text-sm mt-2">陸路廊道：Taipei ↔ Yilan 走國道 5 號；Taoyuan ↔ Yilan 走北橫；Taichung ↔ Hualien 以台 8、台 14 甲與國道 6 號組成山區路線；Pingtung / Kaohsiung / Tainan ↔ Taitung 預設走南迴台 9 線。火車仍沿鐵路環繞，不會穿越中央山脈。</p>
              </div>}
              <details className="text-sm text-slate-600 rounded-xl border p-4">
                <summary className="font-bold cursor-pointer">Teacher notes · 課堂估算說明</summary>
                <p className="mt-3">這是交通可行性的入門檢核，未查詢即時班次、天氣、接駁銜接與路況。飛機預留 1.5 小時供報到及市區接駁；渡輪時間含港口接駁與登船。渡輪港口接駁碳排以公車估算。</p>
                <p className="mt-2">碳排沿用原課堂係數；新增 Ferry 暫用 120 g CO₂／人公里作教學假設，非官方實測值。步行與單車的 0 僅指使用階段。比較須同時考量距離、時間與交通是否可行。</p>
                <p className="mt-2">四天行程分日檢核，每天交通最多 {MAX_LEG_HOURS} 小時（基隆—馬祖渡輪例外）；每天步行示範上限 30 km、單車 80 km，不是六年級學生實際出遊建議。教師可修改 MAX_LEG_HOURS 與 routeEstimate 設定。</p>
                <p className="mt-2">公車與汽車的橫向路線採固定教學廊道，並非即時導航。中橫西段不是一般遊客可完整直通的道路，因此 Hualien ↔ Taichung 不畫成完整台 8 線；南橫台 20 線受管制影響，也不作為預設路線。實際出發前仍須查詢官方即時路況。</p>
                <a className="underline block mt-2" href="https://www.penghu-nsa.gov.tw/ChiHoOneLer/transport/Traffic/Traffic/ship01.htm" target="_blank" rel="noopener noreferrer">澎湖國家風景區：輪船資訊（船班與季節另查）</a>
              </details>
              {/* Action Button */}
              <div className="pt-8 pb-4">
                <p className="text-center text-sm font-medium text-slate-400 mb-6 italic">
                  * Distances and carbon emissions are estimates for classroom learning.
                </p>

                <div className="space-y-4">
                  {!canContinue && (
                    <div className="flex items-center justify-center gap-2 text-amber-700 bg-amber-50 py-3 px-6 rounded-xl border border-amber-200 mx-auto max-w-fit font-bold">
                      <AlertCircle className="w-5 h-5" />
                      {getMissingInfo()}
                    </div>
                  )}
                  <button
                    onClick={handleContinue}
                    disabled={!canContinue}
                    className={`w-full max-w-md mx-auto block py-5 rounded-2xl font-black text-lg md:text-xl transition-all shadow-xl ${
                      canContinue
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white transform hover:-translate-y-1'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    CONTINUE TO ENGLISH CHECK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STAGE 2: English Check ================= */}
          {stage === "english" && (
            <div className="space-y-10 max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center space-y-3">
                <h2 className="text-2xl md:text-3xl font-black text-slate-800">Complete Your Sentences</h2>
                <p className="text-slate-600 font-medium text-lg">Choose the correct words to match your final travel plan.</p>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 md:p-10 border-2 border-slate-200 space-y-8 shadow-inner">
                {currentPlanDetails.steps.map((step, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-3 text-lg md:text-xl font-bold text-slate-700 leading-loose">
                    <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{SEQUENCE_ADVERBS[index]},</span> 
                    <span>we go {index === 3 ? "back " : ""}to</span>
                    
                    <select 
                      value={englishAnswers[index].dest}
                      onChange={(e) => {
                        const newAns = [...englishAnswers];
                        newAns[index].dest = e.target.value;
                        setEnglishAnswers(newAns);
                        setEnglishResult(null);
                        setReadAloud(false);
                      }}
                      className="p-2 rounded-xl border-2 border-slate-300 focus:border-emerald-500 bg-white min-w-[120px] shadow-sm cursor-pointer"
                    >
                      <option value="">-- Place --</option>
                      {["Taipei", ...places].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    <select 
                      value={englishAnswers[index].trans}
                      onChange={(e) => {
                        const newAns = [...englishAnswers];
                        newAns[index].trans = e.target.value;
                        setEnglishAnswers(newAns);
                        setEnglishResult(null);
                        setReadAloud(false);
                      }}
                      className="p-2 rounded-xl border-2 border-slate-300 focus:border-emerald-500 bg-white min-w-[160px] shadow-sm cursor-pointer"
                    >
                      <option value="">-- Transport --</option>
                      {Object.values(TRANSPORT_DATA).map(t => (
                        <option key={t.id} value={t.id}>{t.label.toLowerCase()}</option>
                      ))}
                    </select>
                    <span>.</span>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                <button
                  onClick={handleCheckEnglish}
                  className="w-full md:w-auto md:px-12 mx-auto block py-4 rounded-2xl font-black text-lg transition-all shadow-md bg-slate-800 hover:bg-slate-700 text-white"
                >
                  CHECK MY ENGLISH
                </button>

                {englishResult === 'wrong' && (
                  <div className="text-center bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 font-bold flex items-center justify-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Look at your route and try again.
                  </div>
                )}

                {englishResult === 'correct' && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <div className="text-center bg-emerald-100 text-emerald-800 p-4 rounded-xl border border-emerald-200 font-bold text-lg flex items-center justify-center gap-2">
                      <ShieldCheck className="w-6 h-6" /> Excellent! Your sentences match your travel plan.
                    </div>
                    
                    <label className="flex items-center gap-4 p-6 bg-white border-2 border-blue-200 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors shadow-sm">
                      <input 
                        type="checkbox" 
                        checked={readAloud}
                        onChange={(e) => setReadAloud(e.target.checked)}
                        className="w-6 h-6 md:w-8 md:h-8 text-blue-600 rounded-lg border-slate-300 focus:ring-blue-500"
                      />
                      <span className="text-lg md:text-xl font-bold text-blue-900">
                        We read our travel plan aloud to our partner.
                      </span>
                    </label>

                    <button
                      disabled={!readAloud}
                      onClick={() => {
                        setStage("report");
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full py-5 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-2 ${
                        readAloud 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white transform hover:-translate-y-1'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ClipboardCheck className="w-7 h-7" /> GENERATE FINAL LOG
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 3: Final Report (Gouache Game Map Style) ================= */}
          {stage === "report" && (
            <div className="animate-in fade-in zoom-in-95 duration-500">
              {/* Main Game Map Canvas */}
              <div className="bg-[#FAF7F2] rounded-[2rem] overflow-hidden shadow-2xl border-[6px] md:border-[12px] border-white max-w-4xl mx-auto">
                
                {/* 1. ECO QUEST Title Header */}
                <div className="bg-amber-400 p-6 md:p-8 text-slate-900 text-center relative border-b-[6px] border-amber-500">
                  <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 2px)', backgroundSize: '16px 16px' }}></div>
                  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter drop-shadow-md relative z-10">
                    ECO QUEST: A Low-Carbon Taiwan Adventure
                  </h2>
                  <div className="mt-3 inline-block bg-white px-6 py-2 rounded-full border-4 border-slate-900 shadow-[4px_4px_0_#1e293b] relative z-10">
                    <p className="text-slate-800 font-black uppercase tracking-widest text-xs md:text-sm">
                      Team: <span className="text-emerald-600">{teamName}</span>
                    </p>
                  </div>
                </div>

                <TripMap steps={currentPlanDetails.steps as TripStep[]} teamName={teamName} />

                {/* 3. Mission Complete Area */}
                <div className="bg-slate-900 p-6 md:p-10 text-white">
                  <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-8">
                    
                    {/* Badge Column */}
                    <div className="flex-shrink-0 text-center space-y-3">
                      <div className="w-32 h-32 md:w-40 md:h-40 mx-auto bg-emerald-500 rounded-full border-8 border-slate-800 flex items-center justify-center relative shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                        <div className="text-center">
                          <Leaf className="w-12 h-12 md:w-16 md:h-16 text-green-200 mx-auto mb-1 fill-green-400" />
                          <span className="block font-black text-sm md:text-base leading-tight uppercase">Green<br/>Traveler</span>
                        </div>
                      </div>
                      <h3 className="text-xl md:text-2xl font-black uppercase tracking-widest text-emerald-400">Mission Complete!</h3>
                    </div>

                    <div className="flex-grow w-full bg-slate-800 p-6 rounded-2xl border-2 border-slate-700 text-center md:text-left">
                      <p className="text-sm md:text-base font-black text-slate-400 uppercase tracking-widest mb-2">Your Carbon Footprint</p>
                      <p className="text-4xl md:text-5xl font-black text-emerald-400">
                        {currentPlanDetails.totalCarbon.toLocaleString()}
                        <span className="text-lg md:text-xl text-slate-300 ml-2">g CO₂</span>
                      </p>
                      <p className="text-sm text-slate-400 mt-3">Estimated carbon total for all 4 days.</p>
                    </div>
                  </div>
                </div>

                {/* 4. English Travel Sentences */}
                <div className="bg-white p-6 md:p-10">
                  <div className="max-w-3xl mx-auto bg-slate-50 border-4 border-slate-900 rounded-3xl p-6 md:p-8 shadow-[6px_6px_0_#1e293b] relative">
                    <div className="absolute -top-4 left-6 bg-blue-500 text-white px-4 py-1 rounded-full border-2 border-slate-900 text-xs font-black uppercase">
                      My Travel Plan
                    </div>
                    <div className="space-y-3 mt-4">
                      {getFinalSentences().map((sentence, idx) => (
                        <p key={idx} className="text-lg md:text-xl font-bold text-slate-800 leading-relaxed border-b-2 border-slate-200 border-dashed pb-2">
                          {sentence}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Google Maps Opt */}
                  <div className="mt-8 text-center space-y-4">
                    <button 
                      onClick={openGoogleMaps} 
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black transition-all shadow-md"
                    >
                      <MapPin className="w-5 h-5" /> Optional: See Your Route on Google Maps
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-center mt-10">
                <button 
                  onClick={resetAll}
                  className="text-slate-500 hover:text-emerald-600 font-bold underline transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" /> Start a New Adventure
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Named exports support automated classroom-route checks without changing the UI.
export { routeEstimate, illustrativePath };
