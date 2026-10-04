// Tours describe the facilities represented in this prototype, not surveyed layouts.
const stop=(title,description,points,camPos,targetPos,workflow='none',floor=null)=>({title,description,points,camPos,targetPos,workflow,floor,duration:14000});
export function stationTour(site){
 const bharati=site==='bharati';
 const overview=stop(`Welcome to ${bharati?'Bharati':'Maitri'}`, 'Explore how the station supports research and daily life in Antarctica.', ['Follow the water, energy, heating and cargo systems.','Operational readings are simulated; room placement is interpreted.'],bharati?[54,39,67]:[30,26,46],bharati?[0,5,0]:[0,2,0]);
 const exterior=bharati?[
 stop('A station raised above the ground','The model shows the elevated building, supports and entrance stairs.',['Inspect the structure and the access route.','Weather exercises change the simulated wind and vibration readings.'],[39,20,34],[0,6,0]),
 stop('From seawater to drinking water','Follow the blue flow from the coastal intake toward water treatment.',['The intake supplies the treatment plant.','The model represents treatment and potable-water distribution.'],[48,18,-22],[30,2,-28],'water'),
 stop('Water treatment inside the station','The treatment room represents filtration and reverse-osmosis equipment.',['Blue packets show the direction of supply.','This cutaway reveals the science and services floor.'],[7,32,-1],[5,3,-8],'water','science'),
 stop('Generators: electricity and recovered heat','The energy centre contains three generator units in the model.',['Generation supplies the station electrical system.','A unit-2 trip highlights the failed generator and changes the simulated load.'],[-27,27,-4],[-19.4,3.9,-11.55],'power','science'),
 stop('Keeping the station warm','The glycol system carries recovered heat into the building.',['Orange shows warm supply; blue shows the return.','A pressure-loss exercise highlights the heat exchanger.'],[-24,26,3],[-19.3,4,-6.05],'heat','science'),
 stop('Fuel storage and transfer','The tanks feed the energy system through a connected outlet manifold.',['Amber packets show fuel transfer.','The dashboard estimates fuel use and remaining days.'],[-55,14,32],[-38,2,17],'power'),
 stop('Electrical distribution and backup','The electrical room contains distribution and backup-power equipment.',['Monitor battery charge, voltage and estimated autonomy.','Backup behaviour is part of the simulated incident response.'],[-26,29,23],[-19,3.8,8],'power','science'),
 stop('Cargo from arrival to stores','Green ground arrows show the cargo journey into the station.',['Start at the west helipad and cargo approach.','Follow the airlock route to expedition stores.'],[-54,32,48],[-22,2,23],'logistics'),
 ]:[
 stop('Main station and access','The model brings living, science and support spaces together.',['Explore the raised building and its entrance.','Select a sensor marker to open its readings.'],[23,14,21],[0,3,0]),
 stop('Water from Lake Priyadarshini','The intake pump begins the station water-supply journey.',['Blue packets travel from the lake toward treatment.','The pump house is represented at the lake edge.'],[43,12,-12],[32,1,-23],'water'),
 stop('Protecting the water pipeline','The surface conduit carries water toward the treatment building.',['Trace heating helps represent freeze protection.','The freeze exercise changes the simulated pipe and water readings.'],[28,14,3],[21,1,-8],'water'),
 stop('Diesel power for station services','The power house represents the diesel generators.',['Amber fuel transfer feeds generation.','Gold electrical pulses show the onward power route.'],[-37,14,11],[-25,2,-3],'power'),
 stop('Fuel reserves and delivery','The fuel tanks connect to the power house through the outlet manifold.',['Inspect the tank connections and transfer direction.','The dashboard shows a simulated fuel-autonomy estimate.'],[-42,12,32],[-27,2,17],'power'),
 stop('Battery backup and UPS','The battery annex supports continuity of electrical services.',['Follow charge, voltage and backup-autonomy readings.','These values demonstrate station monitoring using simulated data.'],[-29,10,17],[-18,2,6],'power'),
 stop('Heating the station','Follow the heating route from the energy plant into the station.',['Warm supply and cool return use different colours.','The model illustrates how heat circulates through station services.'],[-22,23,20],[0,2,0],'heat'),
 stop('Cargo and expedition stores','Green arrows distinguish cargo movement from fluid pipes.',['Follow the delivery approach to the main station.','Stores and workshop spaces support day-to-day operations.'],[-28,25,39],[0,1,18],'logistics'),
 ];
 return [overview,...exterior,
 stop('Science, samples and station support','Open the building to see the spaces represented for research and support.',['Laboratories and sample areas support science.','Medical, workshop and operations spaces support the team.'],bharati?[0,48,24]:[0,27,15],bharati?[0,3,0]:[0,1.1,0],'none','science'),
 stop('Living and working through the season','The station also represents the places needed for daily life.',['Cabins, dining, kitchen and recreation spaces are shown.','Communications and operator spaces connect station activities.'],bharati?[0,48,24]:[0,27,15],bharati?[0,6.5,0]:[0,1.1,0],'none',bharati?'living':'science'),
 stop('Weather and the station around it','The mast represents wind measurement and station weather monitoring.',['A blizzard exercise highlights the anemometer.','Inspect wind direction and speed alongside the station response.'],bharati?[45,16,35]:[31,13,27],bharati?[33,5,21]:[21,5,17]),
 stop('Your station overview','You have followed the systems that keep the station operating.',['Use Telemetry to run an exercise and see affected equipment.','Continue with a camera waypoint or move freely with WASD, Space and Ctrl.'],bharati?[54,39,67]:[30,26,46],bharati?[0,5,0]:[0,2,0])];
}
