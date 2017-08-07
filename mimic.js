// Mimic Me!
// Fun game where you need to express emojis being displayed

// --- Game variables ---

const DEBUG = false;

var currentIndex = -1;
var score = 0;
var attempts = 0;
var fullGameTimeout;
var timeout;
var timer;

// --- Affectiva setup ---

// The affdex SDK Needs to create video and canvas elements in the DOM
var divRoot = $("#camera")[0];  // div node where we want to add these elements
var width = 640, height = 480;  // camera image size
var faceMode = affdex.FaceDetectorMode.LARGE_FACES;  // face mode parameter

// Initialize an Affectiva CameraDetector object
var detector = new affdex.CameraDetector(divRoot, width, height, faceMode);

// Enable detection of all Expressions, Emotions and Emojis classifiers.
detector.detectAllEmotions();
detector.detectAllExpressions();
detector.detectAllEmojis();
detector.detectAllAppearance();

// --- Utility values and functions ---

// Unicode values for all emojis Affectiva can detect
// (removed 128524 - It's hard to play with it due to closed eyes)
var emojis = [ 128515, 128527, 128521, 128535, 128539, 128540, 128542, 128545, 128563, 128561, 128528, 9786 ];

// Update target emoji being displayed by supplying a unicode value
function setTargetEmoji(code) {
  // Swapping the ugly emoji! ;P
  code = (code === 9786) ? 128578 : code;

  // Hide, update and fade-in new emoji
  $("#target").stop().fadeTo(200, 0);
  $("#target").delay(200).html("&#" + code + ";");
  $("#target").delay(200).stop().fadeTo(600, 1);
}

// Convert a special character to its unicode value (can be 1 or 2 units long)
function toUnicode(c) {
  if(c.length == 1)
    return c.charCodeAt(0);
  return ((((c.charCodeAt(0) - 0xD800) * 0x400) + (c.charCodeAt(1) - 0xDC00) + 0x10000));
}

// Update score being displayed
function setScore(correct, total) {
  //$("#score").html("Score: " + correct + "/" + total);
  $("#score").html("Score: " + correct);
}

// Display log messages and tracking results
function log(node_name, msg) {
  $(node_name).append("<span>" + msg + "</span><br />");
}

// Write tracking results
function writeResults(faces, timestamp) {
  $('#results').html("");

  if (DEBUG === true) {
    // Report how many faces were found
    log('#results', "Timestamp: " + timestamp.toFixed(2));
    log('#results', "Number of faces found: " + faces.length);

    if (faces.length > 0) {
      // Report desired metrics
      log('#results', "Appearance: " + JSON.stringify(faces[0].appearance));
      log('#results', "Emotions: " + JSON.stringify(faces[0].emotions, function(key, val) {
            return val.toFixed ? Number(val.toFixed(0)) : val;
          }));
      log('#results', "Expressions: " + JSON.stringify(faces[0].expressions, function(key, val) {
            return val.toFixed ? Number(val.toFixed(0)) : val;
          }));
      log('#results', "Emoji: " + faces[0].emojis.dominantEmoji);
    }
  } else {
    $('#results').append("<p>Faces found: " + faces.length + "</p>");
    if (faces.length > 0) {
      for(var emo in faces[0].emotions){
        var size = 12 + (8 * (faces[0].emotions[emo] / 100));
        $('#results').append('<p class="emotion" style="font-size: ' + size + 'px">' + emo + '</p>');
      }
    }
  }
}

// Write log messages
function writeLogs(message, debugOnly, keepPrevious) {
  if (keepPrevious === true || DEBUG === true) {
    log('#logs', message);
  } else {
    if (debugOnly !== true) {
      $('#logs').html("");
      log('#logs', message);
    }
  }
}

// Get Random integer (without repeating previous)
function getRandomInt(min, max, previous) {
  var rand = Math.floor(Math.random() * (max - min) + min);
  if (rand === previous) {
    rand = (rand >= (max-1)) ? 0 : rand+1;
  }
  return rand;
}

// Reset the UI
function resetView() {
  // Reset variables
  currentIndex = 0;
  score = 0;
  attempts = 0;

  // Stop timer and timeout
  clearInterval(timer);
  clearTimeout(timeout);

  // Update Scores
  setScore(0, 0); // reset scores

  // Clear results and logs
  $('#results').html("");  // clear out results
  $("#logs").html("");  // clear out previous log
  $('#feedback').html(""); // clear feedback messages
}

// --- Callback functions ---

// Start button
function onStart() {
  if (detector && !detector.isRunning) {
    resetView();
    detector.start();  // start detector
    $(".btn-play").fadeOut(300); // Hide large play button on video container
  }
  writeLogs("STARTING...");
}

// Stop button
function onStop() {
  if (detector && detector.isRunning) {
    detector.removeEventListener();
    detector.stop();  // stop detector
    $(".btn-play").fadeIn(300); // Show large play button on video container
  }
  // Stop timer and timeout
  clearInterval(timer);
  clearTimeout(timeout);

  writeLogs("GAME STOPPED");
};

// Reset button
function onReset() {
  if (detector && detector.isRunning) {
    detector.reset();
  }
  resetView();
  writeLogs("GAME RESET");

  // TODO (optional): You can restart the game as well ✔
  startNewGame();
};

// Add a callback to notify when camera access is allowed
detector.addEventListener("onWebcamConnectSuccess", function() {
  writeLogs("WEBCAM ACCESS ALLOWED", true);
});

// Add a callback to notify when camera access is denied
detector.addEventListener("onWebcamConnectFailure", function() {
  writeLogs("WEBCAM ACCESS DENIED");
  console.log("Webcam access denied");
});

// Add a callback to notify when detector is stopped
detector.addEventListener("onStopSuccess", function() {
  writeLogs("The detector reports stopped", true);
  $("#results").html("");
});

// Add a callback to notify when the detector is initialized and ready for running
detector.addEventListener("onInitializeSuccess", function() {
  writeLogs("The detector reports initialized", true);
  //Display canvas instead of video feed because we want to draw the feature points on it
  $("#face_video_canvas").css("display", "block");
  $("#face_video").css("display", "none");

  // TODO (optional): Call a function to initialize the game, if needed ✔
  startNewGame();
});

// Add a callback to receive the results from processing an image
// NOTE: The faces object contains a list of the faces detected in the image,
//   probabilities for different expressions, emotions and appearance metrics
detector.addEventListener("onImageResultsSuccess", function(faces, image, timestamp) {
  var canvas = $('#face_video_canvas')[0];
  if (!canvas)
    return;

  //Not all the tracking information is relevant to the player. Refactored a bit.
  writeResults(faces, timestamp);
  writeLogs(timestamp.toFixed(2) + " &#9201;");

  // Call functions to draw feature points and dominant emoji (for the first face only)
  drawFeaturePoints(canvas, image, faces[0]);
  drawEmoji(canvas, image, faces[0]);

  // TODO: Call your function to run the game (define it first!) ✔
  updateGame(toUnicode(faces[0].emojis.dominantEmoji));

});

// --- Custom functions ---

// Draw the detected facial feature points on the image
function drawFeaturePoints(canvas, img, face) {
  // Obtain a 2D context object to draw on the canvas
  var ctx = canvas.getContext('2d');

  // TODO: Set the stroke and/or fill style you want for each feature point marker ✔
  // See: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D#Fill_and_stroke_styles
  ctx.strokeStyle = 'rgb(200,255,90)';

  // Loop over each feature point in the face
  if (face) {
    for (var id in face.featurePoints) {
      var featurePoint = face.featurePoints[id];

      // TODO: Draw feature point, e.g. as a circle using ctx.arc() ✔
      // See: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/arc
      ctx.beginPath();
      ctx.arc(featurePoint.x, featurePoint.y, 1.5, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
}

// Draw the dominant emoji on the image
function drawEmoji(canvas, img, face) {
  // Obtain a 2D context object to draw on the canvas
  var ctx = canvas.getContext('2d');

  // TODO: Set the font and style you want for the emoji ✔
  ctx.font = '60px serif';

  // TODO: Draw it using ctx.strokeText() or fillText() ✔
  // See: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText
  // TIP: Pick a particular feature point as an anchor so that the emoji sticks to your face
  if (face) {
    var emo = face.emojis.dominantEmoji;

    // *** REFACTORED *** One Emoji didn't match the rest and it was driving me nuts! Lol! XP
    if (toUnicode(face.emojis.dominantEmoji) === 9786) {
      emo = "\uD83D\uDE42";
    }

    ctx.fillText(emo, face.featurePoints[10].x, face.featurePoints[10].y);
  }
}

// TODO: Define any variables and functions to implement the Mimic Me! game mechanics ✔

// NOTE:
// - Remember to call your update function from the "onImageResultsSuccess" event handler above ✔
// - You can use setTargetEmoji() and setScore() functions to update the respective elements
// - You will have to pass in emojis as unicode values, e.g. setTargetEmoji(128578) for a simple smiley ✔
// - Unicode values for all emojis recognized by Affectiva are provided above in the list 'emojis' ✔
// - To check for a match, you can convert the dominant emoji to unicode using the toUnicode() function ✔

// Optional:
// - Define an initialization/reset function, and call it from the "onInitializeSuccess" event handler above ✔
// - Define a game reset function (same as init?), and call it from the onReset() function above ✔

// New Game
function startNewGame() {
  // Start game that'll end in 1.5 minutes
  fullGameTimeout = setTimeout(onGameCompleted, 16000);

  // Start round (timeout helps with the overall player experience)
  clearTimeout(timeout);
  timeout = setTimeout(changeEmoji, 2000);

  writeLogs("GAME STARTED");

  // Feedback to player - Go!
  $('#feedback').html('&#128678; <span class="error-color">GO!</span> &#127937;');
  $('#feedback-container').stop().fadeIn(10).delay(800).fadeOut(100);
}

// Change the emoji after player mimic correctly or ran out of time
function changeEmoji() {
  // Keeping track of each attempt/round
  attempts++;

  // Set a random emoji
  var rand = getRandomInt(0, emojis.length, currentIndex);
  currentIndex = rand;
  setTargetEmoji(emojis[rand]);

  // Adjust timer
  clearInterval(timer);
  // Player will fail at the end of the end of the interval,
  // if successful the timer will reset before failing
  timer = setInterval(function(){recordAttempt("fail")}, 8000);
}

// Check for face match
function updateGame(dominantEmoji) {
  // Check if the player's dominant emoji matches the current emoji
  console.log('dominantEmoji ', dominantEmoji);
  console.log('emojis[currentIndex] ', emojis[currentIndex]);
  console.log('------------------------!');
  if (dominantEmoji === emojis[currentIndex]) {
    recordAttempt("success");
  }
}

// Record scores
function recordAttempt(result) {
  // If successful, add a point and provide feedback
  if (result === "success") {
    score++;
    $('#feedback').html('<span class="success-color">&#10004;</span>');
  } else {
    $('#feedback').html('<span class="error-color">next!</span> &#128073;');
  }
  $('#feedback-container').stop().fadeIn(200).delay(800).fadeOut(200);

  // Update score and get a new emoji
  setScore(score, attempts);
  changeEmoji();
}

// Stop game when completed
function onGameCompleted() {
  // Clear timer and timeouts
  clearTimeout(fullGameTimeout);
  clearTimeout(timeout);
  clearInterval(timer);

  // Stop game but not reset
  if (detector && detector.isRunning) {
    detector.removeEventListener();
    detector.stop();  // stop detector
  }

  // Provide feedback to player
  var accuracy = Math.round((score/attempts) * 100);
  var message = "";

  if (accuracy === 100) { // 110%
    message = '<span class="final-message-color">' + score + '/' + attempts +
              '</span><span class="final-message"> Perfect! </span>&#127942;';
  } else if (accuracy < 100 && accuracy > 79) { // 80% to 99%
    message = '<span class="final-message-color">' + score + '/' + attempts +
              '</span><span class="final-message"> Amazing! </span> &#127881;';
  } else if (accuracy < 80 && accuracy > 49) { // 50% to 79%
    message = '<span class="final-message-color">' + score + '/' + attempts +
              '</span><span class="final-message"> Great job! </span> &#128077;';
  } else if (accuracy < 50 && accuracy > 29) { // 30% to 49%
    message = '<span class="final-message-color">' + score + '/' + attempts +
              '</span><span class="final-message"> Good job! </span> &#128077;';
  } else if (accuracy < 30 && accuracy > 9) { // 9% to 29%
    message = '<span class="final-message-color">' + score + '/' + attempts +
              '</span><span class="final-message"> More practice! </span> &#128584;';
  } else { // < 10%
    message = '<span class="final-message-color">' + score + '/' + attempts +
              '</span><span class="final-message"> Ouch! </span> &#129318;';
  }

  $('#feedback-container').stop().hide();
  $('#feedback').html(message);
  $('#feedback-container').stop().fadeIn(300);

  // Display stats
  writeLogs("YOUR STATS", false, false);
  writeLogs(" ", false, true);
  writeLogs("Rounds: " + attempts, false, true);
  writeLogs("Points: " + score, false, true);
  writeLogs(accuracy + "% accuracy", false, true);
}
