const fetch = require("isomorphic-fetch");
const fccUrl = "https://geo.fcc.gov/api/census/area?";
// const API_KEY = "yCimzW9kEWsaOuYwIl5hfP9A3hSy8rje"; OLD key
const API_KEY = "2kx6z5m2NzEw6T0YBA405t3ubo0Fszn6";
const Url = "http://www.mapquestapi.com/directions/v2/routematrix?key="+API_KEY;

const WEST_BOUND = -76.526182;
const NORTH_BOUND = 42.456826;
const HALF_MILE = 0.00725;

var schools = [];
var malls = [];
var garages = [];
var gasStations = [];
var govtOffices = [];
var bangs = new Ambu("Bang's","Bang's",42.4453215,-76.5168851,0);
var demandPoints = [];
var ambulances = [bangs];

/**
 * @constructor
 * Possible ambulance location in Ithaca, NY
 * 
 * @param {string} type
 *      The category that the spot falls under 
 * @param {string} title 
 *      Parking spot nickname for identification
 * @param {float} lat 
 *      Latitude in decimal degrees
 * @param {float} lng 
 *      Longitude in decimal degrees
 * @param {int} index
 *      Integer id for ambulance point
 * @property {float} scoreNoPop
 *      The calculated "value" of the ambulance point without taking population into account
 * @property {float} scorePop
 *      The calculated "value" of the ambulance point taking into account population proportions of each demand point
 * @property {float} nearestProp
 *      Only applies to ambulances at indices 1 and 15. Sum of population density that ambulance (1 or 15) is responsible for
 *      "Responsible" means closest to.
 */
function Ambu(type,title,lat,lng,index) {
    this.type = type;
    this.title = title;
    this.lat = lat;
    this.lng = lng;
    this.index = index;
    this.scoreNoPop;
    this.scorePop;
    this.nearestProp = 0;
}

/**
 * @constructor
 * Demand point within Ithaca, NY
 * 
 * @param {float} lat
 *      Latitude in decimal degrees
 * @param {float} lng
 *      Longitude in decimal degrees
 * @property {Ambu Array} ambuReach
 *      Set of ambulance locations with <6 min travel time in between
 * @param {int} index
 *      Integer id for ambulance point
 * @property {int} population
 *      Population at the block of the coordinate
 * @property {float} proportion
 *      Population at the block of the coordinate divided by the total calculated block populations
 */
function Demand(lat,lng,index) {
    this.lat = lat;
    this.lng = lng;
    this.ambuReach = [];
    this.index = index;
    this.population;
    this.proportion;
}

//MAIN FUNCTION, function to execute all of the async functions in the correct order
async function main() {
    initAmbulanceData();
    initDemandData();
    await fetchFCC();
    calculateProportion();
    await executeCalls();
    scoreAmbulance(false,1);
    updateScores();

    console.log(ambulances[1].title);
    console.log(ambulances[1].lat);
    console.log(ambulances[1].lng);
    console.log(ambulances[1].scoreNoPop);
    scoreAmbulance(true,1);
    console.log(ambulances[1].scorePop);
    console.log(ambulances[1].nearestProp);
    console.log(ambulances[15].title);
    console.log(ambulances[15].lat);
    console.log(ambulances[15].lng);
    scoreAmbulance(false,15);
    console.log(ambulances[15].scoreNoPop);
    scoreAmbulance(true,15);
    console.log(ambulances[15].scorePop);
    console.log(ambulances[15].nearestProp);
}

main();



/**
 * ------------------------------ HELPER FUNCTIONS ---------------------------
 * |                    For calculation and scoring/weighting nodes          |
 * ---------------------------------------------------------------------------
 */

//Calculate the total population and divide to find the proportion
//Precondition: Execute AFTER calling fetchFCC()
function calculateProportion() {
    var totalPop = 0;
    for (let i=0; i<demandPoints.length; i++) {
        totalPop += demandPoints[i].population;
    }
    for (let i=0; i<demandPoints.length; i++) {
        demandPoints[i].proportion = (demandPoints[i].population)/totalPop;
    }
}

/**
 * Scores one ambulance node (specify by index) by counting how many demand points the ambulance 
 * reaches in under 6 minutes
 * 
 * @param {boolean} weighted
 *      State whether the demand points should be weighted
 * @param {int} index
 *      Index of the ambulance node you wish to score
 * */
function scoreAmbulance(weighted, index) {
    var ambu;
    for(let i=0; i<ambulances.length; i++){
        if (ambulances[i].index == index) {
            ambu = ambulances[i];
        }
    }
    if (weighted) {
        ambu.scorePop = 0;
        for(let i=0;i<demandPoints.length;i++){
            if (compareAD(demandPoints[i].ambuReach, ambu.lat, ambu.lng)) {
                ambu.scorePop+=demandPoints[i].proportion;
            }
        }
    } else {
        ambu.scoreNoPop = 0;
        for(let i=0;i<demandPoints.length;i++){
            if (compareAD(demandPoints[i].ambuReach, ambu.lat, ambu.lng)) {
                ambu.scoreNoPop++;

            }
        }
    }
}

/**
 * Updates scores of our preferred ambulance locations, location 1 (Belle Sherman School)
 * and location 15 (Mobil Gas Station)
 */
function updateScores() {
    var ambu1lat = 42.438026;
    var ambu1lng = -76.478207;
    var ambu15lat = 42.43955;
    var ambu15lng = -76.508107;
    var latLng;
    var proportion;
    var ambu1Time=0;
    var ambu15Time=0;
    var ambu1;
    var ambu15;

    for (let i=0; i<ambulances.length; i++) {
        if(ambulances[i].index == 1) {
            ambu1=ambulances[i];
        }
        else if(ambulances[i].index == 15) {
            ambu15=ambulances[i];
        }
    }

    for (let i=0; i<demandPoints.length; i++) {
        latLng = demandPoints[i].ambuReach;
        proportion = demandPoints[i].proportion;
        for (let n=0; n<latLng.length; n++) {
            if((latLng[n].lat == ambu1lat)&&(latLng[n].lng == ambu1lng)) {
                ambu1Time = latLng[n].time;
            }
            else if((latLng[n].lat == ambu15lat)&&(latLng[n].lng == ambu15lng)) {
                ambu15Time = latLng[n].time;
            }
        }
        if (ambu1Time < ambu15Time) {
            ambu1.nearestProp += proportion;
        }
        else if (ambu15Time < ambu1Time) {
            ambu15.nearestProp += proportion;
        }
    }
}

/**
 * ------------------------------ HELPER FUNCTIONS ---------------------------
 * |                    Functions that initialize coordinate data            |
 * ---------------------------------------------------------------------------
 */

/**
 * Push into arrays data about each ambulance point that we handpicked
 */
function initAmbulanceData() {

    var schoolTitles = ["Belle Sherman School", "Beverly J Martin School", "New Roots Charter School"];
    var schoolLats = [42.438026, 42.441562, 42.440160];
    var schoolLongs = [-76.478207, -76.502234, -76.49934];
    var numSchools = schoolTitles.length;

    var mallTitles = ["Ithaca Shopping Plaza", "Tops Plaza", "Press Bay Alley"];
    var mallLats = [42.430012, 42.431831, 42.438846];
    var mallLongs = [-76.506928, -76.510317, -76.500102];
    var numMalls = mallTitles.length;

    var garageTitles = ["Green Street Garage", "Seneca Street Garage", "Dryden Road Garage"];
    var garageLats = [42.439177, 42.440974, 42.442192];
    var garageLongs = [-76.496639, -76.496649, -76.486123];
    var numGarages = garageTitles.length;

    var gasTitles = ["Sunoco Central", "Fastrac", "Sunny's Convenience", "Mobil", "Sunoco South", "Kwik Fill", "Pete's Grocery", "Mirabito"];
    var gasLats = [42.441052, 42.443714, 42.450600, 42.439550, 42.430664, 42.431172, 42.444854, 42.436866];
    var gasLongs = [-76.499685, -76.508439, -76.504390, -76.508107, -76.497114, -76.508954, -76.512216, -76.464414];
    var numGas = gasTitles.length;

    var govTitles = ["DMV", "Ithaca Public Works"];
    var govLats = [42.447190, 42.453438];
    var govLongs = [-76.504649, -76.503932];
    var numGov = govTitles.length;

    // Create Ambu objects
    for (let i=0; i<numSchools; i++) {
        var school = new Ambu(
            "School",
            schoolTitles[i],
            schoolLats[i],
            schoolLongs[i],
            i+1
        );
        schools.push(school);
        ambulances.push(school);
    }
    for (let i=0; i<numMalls; i++) {
        var mall = new Ambu(
            "Mall",
            mallTitles[i],
            mallLats[i],
            mallLongs[i],
            i+1+numSchools
        );
        malls.push(mall);
        ambulances.push(mall);
    }
    for (let i=0; i<numGarages; i++) {
        var garage = new Ambu(
            "Garage",
            garageTitles[i],
            garageLats[i],
            garageLongs[i],
            i+1+numSchools+numMalls
        );
        garages.push(garage);
        ambulances.push(garage);
    }
    for (let i=0; i<numGov; i++) {
        var gov = new Ambu(
            "Government Office",
            govTitles[i],
            govLats[i],
            govLongs[i],
            i+1+numSchools+numMalls+numGarages
        );
        govtOffices.push(gov);
        ambulances.push(gov);
    }
    for (let i=0; i<numGas; i++) {
        var gas = new Ambu(
            "Gas Station",
            gasTitles[i],
            gasLats[i],
            gasLongs[i],
            i+1+numSchools+numMalls+numGarages+numGov
        );
        gasStations.push(gas);
        ambulances.push(gas);
    }
}

/**
 * Starting from the most north-west coordinate we designate, we calculate the
 * rest of the points in the 5x8 coordinate graph (separated by 1/2 sq mi)
 */
function initDemandData() {
    for (let m=0; m<5; m++) {
        for(let n=0; n<8; n++) {
            demandPoints.push(
                new Demand(
                    NORTH_BOUND - m*HALF_MILE, //subtract b/c we iterate southward
                    WEST_BOUND + n*HALF_MILE, //add b/c iterate eastward
                    m*8 + n
                )
            );
        }
    }
}

/**
 * ------------------------------ HELPER FUNCTIONS ---------------------------
 * |                    Functions that make http reqs (Mapquest, FCC)         |
 * ---------------------------------------------------------------------------
 */


/**
 * Mapquest calculates the time distance between a demand point (first lat-lng coordinate)
 * and each of the 20 ambulance points (next 20 lat-lng coordinates)
 * 
 * Then we add to the demand point the coordinates of the ambulance points where the distance
 * is less than or equal to 6 min
 */
async function executeCalls() {
    //Preparing mapquest API input data
    for (x=0; x<demandPoints.length; x++) {
        var Data = {
            "locations": []
        };
        Data.locations.push(
            {
                "latLng": {
                    "lat": demandPoints[x].lat,
                    "lng": demandPoints[x].lng
                }
            }
        );
        for (y=0; y<ambulances.length; y++) {
            Data.locations.push(
                {
                    "latLng": {
                        "lat": ambulances[y].lat,
                        "lng": ambulances[y].lng
                    }
                }
            );
        };
        //execute the fetch
        response = await fetch(Url, {
            method: 'post',
            body: JSON.stringify(Data)
        });
        var json = await response.json();
        console.log(json);
        timeArray = json.time;
        locationArray = json.locations;

        //filter by time distance
        for(let i=0; i<timeArray.length; i++) {
            if (((timeArray[i]/60)<= 6) && (timeArray[i] != 0)) { //conditional-- exclude from array if: takes longer than 6m, takes 0m (same location)
                console.log("Found a match");
                demandPoints[x].ambuReach.push(
                    {
                        "lat": locationArray[i].latLng.lat,"lng": locationArray[i].latLng.lng,"time":timeArray[i]/60
                    }
                );
            };
        };
    };
};

//HTTP GET request to FCC server, which returns population 
//in block corresponding to lat-lng coordinates specified in url
async function fetchFCC() {
    for (let i=0; i<demandPoints.length; i++) {
        url = fccUrl + "lat=" + demandPoints[i].lat + "&lon=" + demandPoints[i].lng + "&format=json";
        var response = await fetch(url, {
            method: 'get'
        });
        var json = await response.json();
        var result = await json.results[0];
        var blockPop = await result.block_pop_2015;
        demandPoints[i].population = blockPop;
    }
}

/**
 *  ----------------------------- HELPER FUNCTIONS ---------------------------
 *  |               For visibility and formatting data for other code         |
 *  --------------------------------------------------------------------------
 */

/** 
 * Compare latitude and longitude between ambulance coordinate and elements of reached ambulances array in demand point

 * @param {Array} latLng
 *      Array of ambulances that can access the demand point
 * @param {float} lat
 *      Ambulance latitude
 * @param {float} lng
 *      Ambulance longitude
 * @returns {boolean} 
 *      True if demand coordinate reachable by ambulance
*/ 
function compareAD(latLng, lat, lng) {
    for(let i=0; i<latLng.length; i++) {
        if ((lat == latLng[i].lat)&&(lng == latLng[i].lng)) {
            return true;
        }
    }
    return false;
}


 // Prints demand point coordinates along with the ambulance coordinates with <=6 min of driving in between
function printPairwise() {
    for(let i=0; i<demandPoints.length; i++) {
        console.log("Demand point coordinates: "+demandPoints[i].lat+", "+demandPoints[i].lng);
        reachedAmbuPoints = demandPoints[i].ambuReach;
        console.log("Accessible ambulance points:");
        for(let m=0; m<reachedAmbuPoints.length; m++) {
            console.log("Point "+m+": "+reachedAmbuPoints[m].lat+", "+reachedAmbuPoints[m].lng);
        };
    };
}

//See printPairwise-- does the same thing except prints ambulance index (id number) in place of lat/lng
function printPairwiseIndex() {
    for(let i=0; i<demandPoints.length; i++) {
        console.log("Demand point coordinates: "+demandPoints[i].lat+", "+demandPoints[i].lng);
        reachedAmbuPoints = demandPoints[i].ambuReach;
        console.log("Accessible ambulance points: ");
        var tempArr = [];
        for (let m=0; m<reachedAmbuPoints.length; m++) {
            for(let n=0; n<ambulances.length; n++) {
                if ((reachedAmbuPoints[m].lat == ambulances[n].lat) && (reachedAmbuPoints[m].lng == ambulances[n].lng)){
                    tempArr.push(ambulances[n].index);
                }
            }
        }
        console.log(tempArr);
    }
}

//Print same data as printPairwise except formatted in separate arrays for latitude, longitude
//along with following a template for plotly.js
function printPlotData() {
    for(let i=0; i<demandPoints.length; i++){
        var xCoords = [];
        var yCoords = [];
        xCoords.push(demandPoints[i].lng);
        yCoords.push(demandPoints[i].lat);
        reachedAmbuPoints = demandPoints[i].ambuReach;
        for(let m=0; m<reachedAmbuPoints.length; m++) {
            xCoords.push(reachedAmbuPoints[m].lng);
            xCoords.push(demandPoints[i].lng);
            yCoords.push(reachedAmbuPoints[m].lat);
            yCoords.push(demandPoints[i].lat);
        }
        console.log("var demandPoint"+i+"={")
        console.log("x: " + "[" + xCoords + "],");
        console.log("y: " + "[" + yCoords + "],");
        console.log("mode: 'lines+markers', name: 'demandPoint"+i+"', type: 'scatter'};");
    }
}

//Print all data inside ambulance data points
function printAllAmbulanceData() {
    for(let i=0; i<ambulances.length; i++) {
        console.log(ambulances[i].index);
        console.log(ambulances[i].lat);
        console.log(ambulances[i].lng);
    }
}

//Print all data inside demand point, formatted for calculations in python
function printAllDemandData() {
    var tempArr = [];
    for(let i=0; i<demandPoints.length; i++) {
        console.log("Demand point "+demandPoints[i].index+":");
        console.log(demandPoints[i].lat+" , "+demandPoints[i].lng);
        console.log(demandPoints[i].population);
        console.log(demandPoints[i].proportion);
        tempArr.push(demandPoints[i].proportion);
    }
    console.log('['+tempArr+']');
}

