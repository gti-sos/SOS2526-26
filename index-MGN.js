


const dataPart1 = require('./Data/csvjson.json'); 
const dataPart2 = require('./Data/csvjson2.json');

 allDataRaw = [...dataPart1, ...dataPart2];
const dataClean = allDataRaw
    .filter(object => object.country !== "---" );
const targetCountry = "Argentina";

const average = dataClean
    .filter(object => object.country === targetCountry)
    .map(object => parseFloat(object.score))
    
    // C. Calcular la media usando reduce
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
