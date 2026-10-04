// Illustrative scene scenarios, not observed weather or a snow-depth forecast.
export const WEATHER_OPTIONS=[['auto','Follow station'],['mild','Mild'],['cold','Cold'],['extreme','Extreme cold'],['blizzard','Blizzard']];
const PROFILES={
 mild:{name:'Mild',temperature:[-2,0],wind:12,cover:.14,snowfall:0,fog:[125,235],sky:'#a5c4d7',sun:1.65,description:'Exposed rock · scattered settled snow'},
 cold:{name:'Cold',temperature:[-16,-14],wind:32,cover:.5,snowfall:.22,fog:[95,195],sky:'#a9bccb',sun:1.1,description:'Broader snow cover · light snowfall'},
 extreme:{name:'Extreme cold',temperature:[-35,-28],wind:48,cover:.86,snowfall:.06,fog:[85,175],sky:'#99afc4',sun:.85,description:'Settled winter snow · fine drifting ice'},
 blizzard:{name:'Blizzard',temperature:[-28,-24],wind:98,cover:.95,snowfall:1,fog:[42,145],sky:'#aab9c2',sun:.45,description:'Wind-blown snow · reduced visibility'},
};
export function sceneWeather(site,choice,telemetry){
 const temp=Number(telemetry?.kpis?.ambient_temp??telemetry?.ambient_temp??-16);
 const wind=Number(telemetry?.kpis?.wind_speed??25);
 const condition=String(telemetry?.weather_condition||'');
 const exercise=telemetry?.active_incident==='BLIZZARD_ALERT';
 const id=exercise?'blizzard':choice==='auto'?(temp<=-28?'extreme':temp<=-8?'cold':'mild'):choice;
 const p=PROFILES[id]||PROFILES.cold;
 const result={...p,id,temperature:p.temperature[site==='maitri'?0:1],direction:Number(telemetry?.wind_direction??115)};
 if(site==='bharati')result.cover=Math.max(.08,result.cover-.06); // Wind-scoured coastal bedrock.
 if(choice==='auto'||exercise){
  result.temperature=temp;result.wind=wind;
  result.snowfall=id==='blizzard'?1:/snow|blizzard|drift/i.test(condition)?p.snowfall:0;
  result.description=exercise?'Blizzard exercise · strong wind / blowing snow':result.snowfall?'Station conditions · snow / drift shown':'Station conditions · settled snow, no snowfall';
 }
 return result;
}
