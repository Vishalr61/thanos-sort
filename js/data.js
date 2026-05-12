/**
 * Data and pure helpers for Thanos Sort: people, land coords, continent outlines.
 */

export const FIRST = [
  'James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella',
  'William', 'Mia', 'Alexander', 'Charlotte', 'Elijah', 'Amelia', 'Benjamin', 'Harper', 'Lucas', 'Evelyn',
  'Henry', 'Abigail', 'Sebastian', 'Emily', 'Jack', 'Ella', 'Owen', 'Scarlett', 'Samuel', 'Grace'
];

export const LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
];

export const LAND_COORDS = [
  [40.71, -74.01], [51.51, -0.13], [35.68, 139.65], [48.86, 2.35], [34.05, -118.24], [41.88, -87.63], [19.43, -99.13], [-33.87, 151.21],
  [55.76, 37.62], [39.90, 116.41], [28.61, 77.21], [-23.55, -46.63], [25.20, 55.27], [37.77, -122.42], [52.52, 13.41], [41.39, 2.17],
  [59.33, 18.07], [43.65, -79.38], [-34.60, -58.38], [22.32, 114.17], [1.35, 103.82], [37.57, 126.98], [19.08, 72.88], [31.23, 121.47],
  [41.01, 28.98], [55.95, -3.19], [35.23, -80.84], [33.45, -112.07], [39.74, -104.99], [25.76, -80.19], [33.75, -84.39], [45.50, -73.57],
  [50.45, 30.52], [50.08, 14.44], [48.21, 16.37], [40.42, -3.70], [41.90, 12.50], [38.72, -9.14], [59.93, 30.34], [-22.91, -43.17],
  [-6.21, 106.85], [14.60, 120.98], [13.76, 100.50], [30.04, 31.24], [-26.20, 28.05], [6.52, 3.38], [9.08, 8.68], [39.93, 32.86], [33.51, 36.28],
  [32.78, -96.80],
];

export const CONTINENTS = {
  northAmerica: [[-170,70],[-160,70],[-140,70],[-130,55],[-125,50],[-125,40],[-115,32],[-105,28],[-100,26],[-95,30],[-85,30],[-80,25],[-75,45],[-65,48],[-55,52],[-60,55],[-75,58],[-140,60],[-165,58],[-170,70]],
  southAmerica: [[-82,12],[-78,8],[-77,0],[-70,-5],[-75,-15],[-70,-35],[-55,-35],[-50,-20],[-45,-15],[-40,-5],[-35,5],[-35,15],[-50,10],[-70,-10],[-82,12]],
  europe: [[-10,36],[-5,43],[0,48],[8,54],[15,56],[25,55],[30,52],[35,45],[40,44],[45,42],[50,52],[55,58],[25,71],[15,70],[5,62],[0,51],[-5,50],[-10,36]],
  africa: [[-18,35],[-10,37],[5,37],[15,32],[25,32],[32,30],[40,12],[44,12],[51,12],[40,-5],[30,-12],[15,-35],[10,-35],[-5,0],[-18,15],[-18,35]],
  asia: [[25,40],[35,42],[45,42],[55,45],[60,55],[75,55],[90,30],[100,20],[105,10],[110,20],[120,25],[130,45],[140,50],[155,50],[165,60],[180,65],[180,75],[140,73],[100,75],[80,55],[60,55],[50,45],[45,35],[40,30],[35,30],[25,40]],
  australia: [[113,-12],[125,-15],[135,-12],[145,-18],[153,-25],[153,-38],[143,-38],[130,-32],[118,-35],[113,-26],[113,-12]],
  greenland: [[-45,60],[-40,65],[-25,83],[-30,83],[-45,72],[-45,60]],
  madagascar: [[44,-12],[50,-12],[50,-26],[44,-26],[44,-12]],
  britishIsles: [[-10,50],[-6,55],[-4,58],[0,59],[2,53],[-2,51],[-10,50]],
  japan: [[130,33],[140,35],[145,43],[142,45],[130,38],[128,33],[130,33]],
  newGuinea: [[141,-2],[155,-5],[155,-10],[141,-8],[141,-2]],
  indonesia: [[95,-6],[105,-6],[115,-8],[120,-5],[125,-10],[118,-8],[95,-6]],
};

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pointInPolygon(lng, lat, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [lngI, latI] = polygon[i];
    const [lngJ, latJ] = polygon[j];
    if (((latI > lat) !== (latJ > lat)) && (lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI)) inside = !inside;
  }
  return inside;
}

export function isOnLand(lng, lat) {
  for (const key of Object.keys(CONTINENTS)) {
    if (pointInPolygon(lng, lat, CONTINENTS[key])) return true;
  }
  return false;
}

export function generatePeople() {
  const firsts = shuffle(FIRST);
  const lasts = shuffle(LAST);
  const spots = shuffle(LAND_COORDS.map(([lat, lng]) => ({ lat, lng })));
  // Offset the last-name index by floor(i / firsts.length) so wraps don't
  // collide (firsts.length == lasts.length would otherwise yield duplicates
  // every N entries). With 30x30 names and 50 spots, this gives 50 unique pairs.
  return spots.map(({ lat, lng }, i) => {
    const f = i % firsts.length;
    const l = (i + Math.floor(i / firsts.length)) % lasts.length;
    return {
      name: `${firsts[f]} ${lasts[l]}`,
      lat,
      lng
    };
  });
}

export function lngLatToXY(lng, lat, w, h) {
  return { x: ((lng + 180) / 360) * w, y: ((90 - lat) / 180) * h };
}

export function drawContinent(ctx, points, w, h, fillStyle) {
  if (points.length < 2) return;
  ctx.beginPath();
  const p0 = lngLatToXY(points[0][0], points[0][1], w, h);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < points.length; i++) {
    const p = lngLatToXY(points[i][0], points[i][1], w, h);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  if (fillStyle) ctx.fillStyle = fillStyle;
  ctx.fill();
}
