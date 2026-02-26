const dataPart1 = require('./Data/csvjson.json'); 
const dataPart2 = require('./Data/csvjson2.json');
allDataRaw = [...dataPart1, ...dataPart2];
const dataClean = getCleanData(allDataRaw);
const targetCountry = "Argentina";

const average = dataClean
    .filter(object => object.country === targetCountry)
    .map(object => parseFloat(object.score))
    .reduce((acc, current, index, array) => {
        acc += current;
        if (index === array.length - 1) {
            return acc / array.length;
        }
        return acc;
    }, 0);

// 4. Mostrar resultado
console.log(`--- SOS2526-26 Analysis (SDV) ---`);
console.log(`Country analyzed: ${targetCountry}`);
console.log(`Calculated Average Score: ${average.toFixed(2)}`);

module.exports = { average, targetCountry };
module.exports = { dataClean };





function getCleanData(raw) {
    let lastValidCountry = "";
    return raw
        .filter(obj => obj.country !== "---")
        .map(obj => {
            if (obj.country && obj.country.trim() !== "") {
                lastValidCountry = obj.country;
            } else {
                obj.country = lastValidCountry;
            }
            return obj;
        });
}
