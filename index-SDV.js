let data = new Array();

data[0] = [2022, "España", 0.911, 27, 1];
data[1] = [2022, "Alemania", 0.95, 7, 0];
data[2] = [2022, "Reino Unido", 0.94, 15, 2];
data[3] = [2022, "Francia", 0.91, 28, -1];
data[4] = [2022, "Italia", 0.906, 30, 0];
data[5] = [2022, "Portugal", 0.874, 42, -3];
data[6] = [2022, "Estados Unidos", 0.927, 20, 1];
data[7] = [2022, "Japón", 0.92, 24, -2];
data[8] = [2022, "China", 0.788, 75, -1];
data[9] = [2021, "España", 0.904, 28, 1];
// Calcular la media de IDH en España
let sumaTotal = 0;
let cont = 0;
data.forEach(fila => {
    if(fila[1] === "España") {
        sumaTotal += fila[2];
        cont++;
    }
})
console.log("La media de IDH en España es de " + sumaTotal / cont)