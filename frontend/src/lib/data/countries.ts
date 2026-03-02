export const COUNTRY_CITIES: Record<string, { flag: string; name: string; cities: {name: string, lat: number, lng: number}[] }> = {
  IN: { flag:'🇮🇳', name:'India', cities:[{name:'Kolkata', lat:22.5726, lng:88.3639}, {name:'Mumbai', lat:19.0760, lng:72.8777}, {name:'Delhi', lat:28.7041, lng:77.1025}, {name:'Chennai', lat:13.0827, lng:80.2707}, {name:'Bangalore', lat:12.9716, lng:77.5946}] },
  US: { flag:'🇺🇸', name:'United States', cities:[{name:'New York', lat:40.7128, lng:-74.0060}, {name:'Los Angeles', lat:34.0522, lng:-118.2437}, {name:'Chicago', lat:41.8781, lng:-87.6298}, {name:'Houston', lat:29.7604, lng:-95.3698}] },
  CN: { flag:'🇨🇳', name:'China', cities:[{name:'Shanghai', lat:31.2304, lng:121.4737}, {name:'Beijing', lat:39.9042, lng:116.4074}, {name:'Guangzhou', lat:23.1291, lng:113.2644}] },
  BR: { flag:'🇧🇷', name:'Brazil', cities:[{name:'São Paulo', lat:-23.5505, lng:-46.6333}, {name:'Rio de Janeiro', lat:-22.9068, lng:-43.1729}, {name:'Brasília', lat:-15.7975, lng:-47.8919}] },
  RU: { flag:'🇷🇺', name:'Russia', cities:[{name:'Moscow', lat:55.7558, lng:37.6173}, {name:'Saint Petersburg', lat:59.9311, lng:30.3609}] },
  NG: { flag:'🇳🇬', name:'Nigeria', cities:[{name:'Lagos', lat:6.5244, lng:3.3792}, {name:'Abuja', lat:9.0579, lng:7.4951}, {name:'Kano', lat:12.0022, lng:8.5920}] },
  MX: { flag:'🇲🇽', name:'Mexico', cities:[{name:'Mexico City', lat:19.4326, lng:-99.1332}, {name:'Guadalajara', lat:20.6597, lng:-103.3496}] },
  EG: { flag:'🇪🇬', name:'Egypt', cities:[{name:'Cairo', lat:30.0444, lng:31.2357}, {name:'Alexandria', lat:31.2001, lng:29.9187}] },
  GB: { flag:'🇬🇧', name:'United Kingdom', cities:[{name:'London', lat:51.5074, lng:-0.1278}, {name:'Birmingham', lat:52.4862, lng:-1.8904}] },
  FR: { flag:'🇫🇷', name:'France', cities:[{name:'Paris', lat:48.8566, lng:2.3522}, {name:'Marseille', lat:43.2965, lng:5.3698}, {name:'Lyon', lat:45.7640, lng:4.8357}] },
  AE: { flag:'🇦🇪', name:'UAE', cities:[{name:'Dubai', lat:25.2048, lng:55.2708}, {name:'Abu Dhabi', lat:24.4539, lng:54.3773}] },
  ZA: { flag:'🇿🇦', name:'South Africa', cities:[{name:'Johannesburg', lat:-26.2041, lng:28.0473}, {name:'Cape Town', lat:-33.9249, lng:18.4241}] },
  JP: { flag:'🇯🇵', name:'Japan', cities:[{name:'Tokyo', lat:35.6762, lng:139.6503}, {name:'Osaka', lat:34.6937, lng:135.5023}] },
  BD: { flag:'🇧🇩', name:'Bangladesh', cities:[{name:'Dhaka', lat:23.8103, lng:90.4125}, {name:'Chittagong', lat:22.3569, lng:91.7832}] },
  SG: { flag:'🇸🇬', name:'Singapore', cities:[{name:'Singapore City', lat:1.3521, lng:103.8198}] },
};

export const sortedCountries = Object.entries(COUNTRY_CITIES).sort((a, b) => a[1].name.localeCompare(b[1].name));