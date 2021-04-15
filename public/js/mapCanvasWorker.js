var coloursJSON;
var DitherMethods;
var canvasImageData;
var selectedBlocks;
var optionValue_modeNBTOrMapdat;
var optionValue_mapSize_x;
var optionValue_mapSize_y;
var optionValue_staircasing;
var optionValue_whereSupportBlocks;
var optionValue_unobtainable;
var optionValue_transparency;
var optionValue_betterColour;
var optionValue_dithering;

var colourSetsToUse = []; // colourSetIds and shades to use in map
var colourCache = new Map(); // cache for reusing colours in identical pixels
var labCache = new Map();

var materials = [];
var supportBlockCount = []; // TODO make sure to account for noobline

// rgb2lab conversion based on the one from redstonehelper's program
function rgb2lab(rgb) {
  let val = (rgb[0] << 16) + (rgb[1] << 8) + rgb[2];
  if (labCache.has(val)) return labCache.get(val);

  let r1 = rgb[0] / 255.0;
  let g1 = rgb[1] / 255.0;
  let b1 = rgb[2] / 255.0;

  r1 = 0.04045 >= r1 ? (r1 /= 12.0) : Math.pow((r1 + 0.055) / 1.055, 2.4);
  g1 = 0.04045 >= g1 ? (g1 /= 12.0) : Math.pow((g1 + 0.055) / 1.055, 2.4);
  b1 = 0.04045 >= b1 ? (b1 /= 12.0) : Math.pow((b1 + 0.055) / 1.055, 2.4);
  let f = (0.43605202 * r1 + 0.3850816 * g1 + 0.14308742 * b1) / 0.964221,
    h = 0.22249159 * r1 + 0.71688604 * g1 + 0.060621485 * b1,
    k = (0.013929122 * r1 + 0.097097 * g1 + 0.7141855 * b1) / 0.825211,
    l = 0.008856452 < h ? Math.pow(h, 1 / 3) : (903.2963 * h + 16.0) / 116.0,
    m =
      500.0 *
      ((0.008856452 < f ? Math.pow(f, 1 / 3) : (903.2963 * f + 16.0) / 116.0) -
        l),
    n =
      200.0 *
      (l -
        (0.008856452 < k ? Math.pow(k, 1 / 3) : (903.2963 * k + 16.0) / 116.0));

  rgb = [2.55 * (116.0 * l - 16.0) + 0.5, m + 0.5, n + 0.5];
  labCache.set(val, rgb);
  return rgb;
}

function squaredEuclideanMetricColours(pixel1, pixel2) {
  if (optionValue_betterColour) {
    //return deltaE(rgb2lab(pixel1),rgb2lab(pixel2))
    pixel1 = rgb2lab(pixel1);
    pixel2 = rgb2lab(pixel2);
  }
  const r = pixel1[0] - pixel2[0];
  const g = pixel1[1] - pixel2[1];
  const b = pixel1[2] - pixel2[2];
  return r * r + g * g + b * b; // actually L*a*b* if optionValue_betterColour but metric is calculated the same
}

function findClosestColourSetIdAndToneAndRGBTo(pixelRGB) {
  let RGBBinary = (pixelRGB[0] << 16) + (pixelRGB[1] << 8) + pixelRGB[2]; // injective mapping RGB to concatenated binaries
  if (colourCache.has(RGBBinary)) {
    return colourCache.get(RGBBinary);
  } else {
    let shortestDistance = 9999999;
    let closestPixel;

    colourSetsToUse.forEach((colourSet) => {
      Object.keys(colourSet.tonesRGB).forEach((toneKey) => {
        const toneRGB = colourSet.tonesRGB[toneKey];
        let squareDistance = squaredEuclideanMetricColours(toneRGB, pixelRGB);
        if (squareDistance < shortestDistance) {
          shortestDistance = squareDistance;
          closestPixel = {
            colourSetId: colourSet.colourSetId,
            tone: toneKey,
          };
        }
      });
    });
    colourCache.set(RGBBinary, closestPixel);
    return closestPixel;
  }
}

function findClosest2ColourSetIdAndToneAndRGBTo(pixelRGB) {
  let RGBBinary = (pixelRGB[0] << 16) + (pixelRGB[1] << 8) + pixelRGB[2];
  if (colourCache.has(RGBBinary)) {
    return colourCache.get(RGBBinary);
  } else {
    let shortestDistance1 = 9999999;
    let shortestDistance2 = 9999999;
    let closestPixel1 = { colourSetId: null, tone: null }; // best colour
    let closestPixel2 = { colourSetId: null, tone: null }; // second best colour

    colourSetsToUse.forEach((colourSet) => {
      Object.keys(colourSet.tonesRGB).forEach((toneKey) => {
        const toneRGB = colourSet.tonesRGB[toneKey];
        let squareDistance = squaredEuclideanMetricColours(toneRGB, pixelRGB);
        if (squareDistance < shortestDistance1) {
          shortestDistance1 = squareDistance;
          closestPixel1 = {
            colourSetId: colourSet.colourSetId,
            tone: toneKey,
          };
        }
        if (
          squareDistance < shortestDistance2 &&
          colourSetIdAndToneToRGB(
            closestPixel1.colourSetId,
            closestPixel1.tone
          ) !== toneRGB
        ) {
          shortestDistance2 = squareDistance;
          closestPixel2 = {
            colourSetId: colourSet.colourSetId,
            tone: toneKey,
          };
        }
      });
    });
    if (
      shortestDistance2 !== 9999999 && // to make sure closestPixel2.colourSetId/tone is not null
      squaredEuclideanMetricColours(
        colourSetIdAndToneToRGB(closestPixel1.colourSetId, closestPixel1.tone),
        colourSetIdAndToneToRGB(closestPixel2.colourSetId, closestPixel2.tone)
      ) <= shortestDistance2
    ) {
      closestPixel2 = closestPixel1; // if closestPixel1 is a better fit to closestPixel2 than closestPixel2 is to the actual pixel
    }
    let newPixels = [
      shortestDistance1,
      shortestDistance2,
      closestPixel1,
      closestPixel2,
    ];
    colourCache.set(RGBBinary, newPixels);
    return newPixels;
  }
}

function getColourSetsToUse() {
  let colourSetIdsToUse = []; // get selected colour sets
  Object.keys(selectedBlocks).forEach((key) => {
    if (selectedBlocks[key] !== "-1") {
      colourSetIdsToUse.push(key);
    }
  });

  // now get appropriate shades
  if (optionValue_staircasing === "off") {
    colourSetIdsToUse.forEach((colourSetId) => {
      colourSetsToUse.push({
        colourSetId: colourSetId,
        tonesRGB: {
          normal: coloursJSON[colourSetId]["tonesRGB"]["normal"],
        },
      });
    });
  } else if (
    optionValue_modeNBTOrMapdat === "NBT" ||
    !optionValue_unobtainable
  ) {
    colourSetIdsToUse.forEach((colourSetId) => {
      colourSetsToUse.push({
        colourSetId: colourSetId,
        tonesRGB: {
          dark: coloursJSON[colourSetId]["tonesRGB"]["dark"],
          normal: coloursJSON[colourSetId]["tonesRGB"]["normal"],
          light: coloursJSON[colourSetId]["tonesRGB"]["light"],
        },
      });
    });
  } else {
    colourSetIdsToUse.forEach((colourSetId) => {
      colourSetsToUse.push({
        colourSetId: colourSetId,
        tonesRGB: {
          ...coloursJSON[colourSetId]["tonesRGB"],
        },
      });
    });
  }
}

function colourSetIdAndToneToRGB(colourSetId, tone) {
  return coloursJSON[colourSetId]["tonesRGB"][tone];
}

function getMapartImageDataAndMaterials() {
  for (let y = 0; y < optionValue_mapSize_y; y++) {
    let materialsRowToAdd = [];
    let supportBlockRowToAdd = [];
    for (let x = 0; x < optionValue_mapSize_x; x++) {
      let materialsEntryToAdd = {
        whichMap_x: x,
        whichMap_y: y,
        materialsCounts: {},
      };
      colourSetsToUse.forEach((colourSet) => {
        materialsEntryToAdd.materialsCounts[colourSet.colourSetId] = 0;
      });
      let supportBlockEntryToAdd = 0; // NB noobline counted in materials.js
      materialsRowToAdd.push(materialsEntryToAdd);
      supportBlockRowToAdd.push(supportBlockEntryToAdd);
    }
    materials.push(materialsRowToAdd);
    supportBlockCount.push(supportBlockRowToAdd);
  }

  if (colourSetsToUse.length === 0) {
    return;
  }

  const multimapWidth = optionValue_mapSize_x * 128;
  let ditherMatrix;
  let divisor;
  const chosenDitherMethod =
    DitherMethods[
      Object.keys(DitherMethods).find(
        (ditherMethodKey) =>
          DitherMethods[ditherMethodKey].uniqueId === optionValue_dithering
      )
    ];
  if (chosenDitherMethod.uniqueId !== DitherMethods.None.uniqueId) {
    ditherMatrix = chosenDitherMethod.ditherMatrix;
  }
  if (
    [
      DitherMethods.FloydSteinberg.uniqueId,
      DitherMethods.MinAvgErr.uniqueId,
      DitherMethods.Burkes.uniqueId,
      DitherMethods.SierraLite.uniqueId,
      DitherMethods.Stucki.uniqueId,
      DitherMethods.Atkinson.uniqueId,
    ].includes(chosenDitherMethod.uniqueId)
  ) {
    divisor = chosenDitherMethod.ditherDivisor;
  }
  for (let i = 0; i < canvasImageData.data.length; i += 4) {
    const indexR = i;
    const indexG = i + 1;
    const indexB = i + 2;
    const indexA = i + 3;
    if (
      optionValue_modeNBTOrMapdat === "Mapdat" &&
      optionValue_transparency &&
      canvasImageData.data[indexA] < 128
    ) {
      canvasImageData.data[indexR] = 0;
      canvasImageData.data[indexG] = 0;
      canvasImageData.data[indexB] = 0;
      canvasImageData.data[indexA] = 0;
      continue;
    } else {
      canvasImageData.data[indexA] = 255; // full opacity
    }

    const multimap_x = (i / 4) % multimapWidth;
    const multimap_y = (i / 4 - multimap_x) / multimapWidth;
    const whichMap_x = Math.floor(multimap_x / 128);
    const whichMap_y = Math.floor(multimap_y / 128);
    if (multimap_x === 0) {
      postMessage({
        head: "PROGRESS_REPORT",
        body: multimap_y / (128 * optionValue_mapSize_y),
      });
    }
    const oldPixel = [
      canvasImageData.data[indexR],
      canvasImageData.data[indexG],
      canvasImageData.data[indexB],
    ];
    let closestColourSetIdAndTone;
    switch (chosenDitherMethod.uniqueId) {
      // Switch statement that checks the dither method every pixel;
      // I have tested a refactor that only checks once however the time difference is negligible and code quality deteriorates
      case DitherMethods.None.uniqueId: {
        closestColourSetIdAndTone = findClosestColourSetIdAndToneAndRGBTo(
          oldPixel
        );
        const closestColour = colourSetIdAndToneToRGB(
          closestColourSetIdAndTone.colourSetId,
          closestColourSetIdAndTone.tone
        );
        canvasImageData.data[indexR] = closestColour[0];
        canvasImageData.data[indexG] = closestColour[1];
        canvasImageData.data[indexB] = closestColour[2];
        break;
      }
      case DitherMethods.Bayer44.uniqueId:
      case DitherMethods.Bayer22.uniqueId:
      case DitherMethods.Ordered33.uniqueId: {
        const newPixels = findClosest2ColourSetIdAndToneAndRGBTo(oldPixel);
        // newPixels = [shortestDistance1, shortestDistance2, newPixel1, newPixel2]
        if (
          (newPixels[0] * (ditherMatrix[0].length * ditherMatrix.length + 1)) /
            newPixels[1] >
          ditherMatrix[multimap_x % ditherMatrix[0].length][
            multimap_y % ditherMatrix.length
          ]
        ) {
          closestColourSetIdAndTone = newPixels[3];
        } else {
          closestColourSetIdAndTone = newPixels[2];
        }
        const closestColour = colourSetIdAndToneToRGB(
          closestColourSetIdAndTone.colourSetId,
          closestColourSetIdAndTone.tone
        );
        canvasImageData.data[indexR] = closestColour[0];
        canvasImageData.data[indexG] = closestColour[1];
        canvasImageData.data[indexB] = closestColour[2];
        break;
      }
      //Error diffusion algorithms
      case DitherMethods.FloydSteinberg.uniqueId:
      case DitherMethods.MinAvgErr.uniqueId:
      case DitherMethods.Burkes.uniqueId:
      case DitherMethods.SierraLite.uniqueId:
      case DitherMethods.Stucki.uniqueId:
      case DitherMethods.Atkinson.uniqueId: {
        closestColourSetIdAndTone = findClosestColourSetIdAndToneAndRGBTo(
          oldPixel
        );
        const closestColour = colourSetIdAndToneToRGB(
          closestColourSetIdAndTone.colourSetId,
          closestColourSetIdAndTone.tone
        );
        canvasImageData.data[indexR] = closestColour[0];
        canvasImageData.data[indexG] = closestColour[1];
        canvasImageData.data[indexB] = closestColour[2];
        const quant_error = [
          oldPixel[0] - closestColour[0],
          oldPixel[1] - closestColour[1],
          oldPixel[2] - closestColour[2],
        ];

        try {
          // ditherMatrix [0][0...2] should always be zero, and can thus be skipped
          if (multimap_x + 1 < multimapWidth) {
            // Make sure to not carry over error from one side to the other
            const weight = ditherMatrix[0][3] / divisor; // 1 right
            canvasImageData.data[i + 4] += quant_error[0] * weight;
            canvasImageData.data[i + 5] += quant_error[1] * weight;
            canvasImageData.data[i + 6] += quant_error[2] * weight;
            if (multimap_x + 2 < multimapWidth) {
              const weight = ditherMatrix[0][4] / divisor; // 2 right
              canvasImageData.data[i + 8] += quant_error[0] * weight;
              canvasImageData.data[i + 9] += quant_error[1] * weight;
              canvasImageData.data[i + 10] += quant_error[2] * weight;
            }
          }

          // First row below
          if (multimap_x > 0) {
            // Order reversed, to allow nesting of 'if' blocks
            const weight = ditherMatrix[1][1] / divisor; // 1 down, 1 left
            canvasImageData.data[i + multimapWidth * 4 - 4] +=
              quant_error[0] * weight;
            canvasImageData.data[i + multimapWidth * 4 - 3] +=
              quant_error[1] * weight;
            canvasImageData.data[i + multimapWidth * 4 - 2] +=
              quant_error[2] * weight;
            if (multimap_x > 1) {
              const weight = ditherMatrix[1][0] / divisor; // 1 down, 2 left
              canvasImageData.data[i + multimapWidth * 4 - 8] +=
                quant_error[0] * weight;
              canvasImageData.data[i + multimapWidth * 4 - 7] +=
                quant_error[1] * weight;
              canvasImageData.data[i + multimapWidth * 4 - 6] +=
                quant_error[2] * weight;
            }
          }
          let weight = ditherMatrix[1][2] / divisor; // 1 down
          canvasImageData.data[i + multimapWidth * 4 + 0] +=
            quant_error[0] * weight;
          canvasImageData.data[i + multimapWidth * 4 + 1] +=
            quant_error[1] * weight;
          canvasImageData.data[i + multimapWidth * 4 + 2] +=
            quant_error[2] * weight;
          if (multimap_x + 1 < multimapWidth) {
            const weight = ditherMatrix[1][3] / divisor; // 1 down, 1 right
            canvasImageData.data[i + multimapWidth * 4 + 4] +=
              quant_error[0] * weight;
            canvasImageData.data[i + multimapWidth * 4 + 5] +=
              quant_error[1] * weight;
            canvasImageData.data[i + multimapWidth * 4 + 6] +=
              quant_error[2] * weight;
            if (multimap_x + 2 < multimapWidth) {
              const weight = ditherMatrix[1][4] / divisor; // 1 down, 2 right
              canvasImageData.data[i + multimapWidth * 4 + 8] +=
                quant_error[0] * weight;
              canvasImageData.data[i + multimapWidth * 4 + 9] +=
                quant_error[1] * weight;
              canvasImageData.data[i + multimapWidth * 4 + 10] +=
                quant_error[2] * weight;
            }
          }

          // Second row below
          if (multimap_x > 0) {
            const weight = ditherMatrix[2][1] / divisor; // 2 down, 1 left
            canvasImageData.data[i + multimapWidth * 8 - 4] +=
              quant_error[0] * weight;
            canvasImageData.data[i + multimapWidth * 8 - 3] +=
              quant_error[1] * weight;
            canvasImageData.data[i + multimapWidth * 8 - 2] +=
              quant_error[2] * weight;
            if (multimap_x > 1) {
              const weight = ditherMatrix[2][0] / divisor; // 2 down, 2 left
              canvasImageData.data[i + multimapWidth * 8 - 8] +=
                quant_error[0] * weight;
              canvasImageData.data[i + multimapWidth * 8 - 7] +=
                quant_error[1] * weight;
              canvasImageData.data[i + multimapWidth * 8 - 6] +=
                quant_error[2] * weight;
            }
          }
          weight = ditherMatrix[2][2] / divisor; // 2 down
          canvasImageData.data[i + multimapWidth * 8 + 0] +=
            quant_error[0] * weight;
          canvasImageData.data[i + multimapWidth * 8 + 1] +=
            quant_error[1] * weight;
          canvasImageData.data[i + multimapWidth * 8 + 2] +=
            quant_error[2] * weight;
          if (multimap_x + 1 < multimapWidth) {
            const weight = ditherMatrix[2][3] / divisor; // 2 down, 1 right
            canvasImageData.data[i + multimapWidth * 8 + 4] +=
              quant_error[0] * weight;
            canvasImageData.data[i + multimapWidth * 8 + 5] +=
              quant_error[1] * weight;
            canvasImageData.data[i + multimapWidth * 8 + 6] +=
              quant_error[2] * weight;
            if (multimap_x + 2 < multimapWidth) {
              const weight = ditherMatrix[2][4] / divisor; // 2 down, 2 right
              canvasImageData.data[i + multimapWidth * 8 + 8] +=
                quant_error[0] * weight;
              canvasImageData.data[i + multimapWidth * 8 + 9] +=
                quant_error[1] * weight;
              canvasImageData.data[i + multimapWidth * 8 + 10] +=
                quant_error[2] * weight;
            }
          }
        } catch (e) {
          console.log(e); // ???
        }
        break;
      }
      default:
        break;
    }
    materials[whichMap_y][whichMap_x].materialsCounts[
      closestColourSetIdAndTone.colourSetId
    ] += 1;
    switch (optionValue_whereSupportBlocks) {
      case "Important":
        if (
          coloursJSON[closestColourSetIdAndTone.colourSetId]["blocks"][
            selectedBlocks[closestColourSetIdAndTone.colourSetId]
          ]["supportBlockMandatory"]
        ) {
          supportBlockCount[whichMap_y][whichMap_x] += 1;
        }
        break;
      case "All":
        supportBlockCount[whichMap_y][whichMap_x] += 1;
        break;
      case "AllDoubleOptimized": // TODO
        break;
      case "AllDouble":
        supportBlockCount[whichMap_y][whichMap_x] += 2;
        break;
      case "None":
      default:
        break;
    }
  }
}

onmessage = (e) => {
  coloursJSON = e.data.body.coloursJSON;
  DitherMethods = e.data.body.DitherMethods;
  canvasImageData = e.data.body.canvasImageData;
  selectedBlocks = e.data.body.selectedBlocks;
  optionValue_modeNBTOrMapdat = e.data.body.optionValue_modeNBTOrMapdat;
  optionValue_mapSize_x = e.data.body.optionValue_mapSize_x;
  optionValue_mapSize_y = e.data.body.optionValue_mapSize_y;
  optionValue_staircasing = e.data.body.optionValue_staircasing;
  optionValue_whereSupportBlocks = e.data.body.optionValue_whereSupportBlocks;
  optionValue_unobtainable = e.data.body.optionValue_unobtainable;
  optionValue_transparency = e.data.body.optionValue_transparency;
  optionValue_betterColour = e.data.body.optionValue_betterColour;
  optionValue_dithering = e.data.body.optionValue_dithering;

  getColourSetsToUse();
  getMapartImageDataAndMaterials();
  postMessage({
    head: "PIXELS_MATERIALS_CURRENTSELECTEDBLOCKS",
    body: {
      pixels: canvasImageData,
      materials: materials,
      supportBlockCount: supportBlockCount,
      currentSelectedBlocks: selectedBlocks,
    },
  });
};
