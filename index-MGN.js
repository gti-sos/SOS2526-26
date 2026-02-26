const dataPart1 = require('./Data/csvjson.json'); 
const dataPart2 = require('./Data/csvjson2.json');
allDataRaw = [...dataPart1, ...dataPart2];
const dataClean = new Array();//getCleanData(allDataRaw);
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


const initial_rankings = [{
    "country": "Afganistán",
    "year": 2026,
    "rank": 162,
    "score": 991.19,
    "rank_variation_from_two_thousand_eighteen": -20,
    "best_year": "FALSE"
  },
  {
    "country": "Afganistán",
    "year": 2025,
    "rank": 160,
    "score": 1008.39,
    "rank_variation_from_two_thousand_eighteen": -18,
    "best_year": "FALSE"
  },
  {
    "country": "Afganistán",
    "year": 2024,
    "rank": 158,
    "score": 1017.68,
    "rank_variation_from_two_thousand_eighteen": -16,
    "best_year": "FALSE"
  },
  {
    "country": "Afganistán",
    "year": 2023,
    "rank": 155,
    "score": 1023.04,
    "rank_variation_from_two_thousand_eighteen": -13,
    "best_year": "FALSE"
  },
  {
    "country": "Afganistán",
    "year": 2022,
    "rank": 150,
    "score": 1049.77,
    "rank_variation_from_two_thousand_eighteen": -8,
    "best_year": "FALSE"
  },
  {
    "country": "Afganistán",
    "year": 2021,
    "rank": 150,
    "score": 1052,
    "rank_variation_from_two_thousand_eighteen": -8,
    "best_year": "FALSE"
  },
  {
    "country": "Afganistán",
    "year": 2020,
    "rank": 150,
    "score": 1052,
    "rank_variation_from_two_thousand_eighteen": -8,
    "best_year": "FALSE"
  },
  {
    "country": "Afganistán",
    "year": 2019,
    "rank": 147,
    "score": 1066,
    "rank_variation_from_two_thousand_eighteen": -5,
    "best_year": "FALSE"
  },
  {
    "country": "Afganistán",
    "year": 2018,
    "rank": 142,
    "score": 194,
    "rank_variation_from_two_thousand_eighteen": "---",
    "best_year": "TRUE"
  },
  {
    "country": "Albania",
    "year": 2026,
    "rank": 63,
    "score": 1401.07,
    "rank_variation_from_two_thousand_eighteen": -7,
    "best_year": "FALSE"
  },
  {
    "country": "Albania",
    "year": 2025,
    "rank": 66,
    "score": 1375.95,
    "rank_variation_from_two_thousand_eighteen": -10,
    "best_year": "FALSE"
  },]

module.exports = { average, targetCountry };
module.exports = { dataClean, initial_rankings };