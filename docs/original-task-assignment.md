# Colonist Full-Stack Product Developer Take-Home Assignment

## High Level Goal

Our product manager got the idea to A/B test a checkered positioned button layout for our CTAs. Your goal is to implement this, so we can test out how much better it will perform compared to our current CTA layout.

A noob programmer created the initial code and you need to make the code better.

Ensure everything makes sense, there are no bugs and the players can easily understand what they need to do.

Your submitted code will be A/B tested in this slot <https://postimg.cc/NyPFVQPn>

And scale to 10s of devices <https://postimg.cc/cgrjF1dT>

## Task

- Make sure buttons are checkered positioned
- Implement all the styles of these 2 buttons: <https://postimg.cc/3ywbwr4X>
- The aspect ratio for both buttons needs to be like the orange button above
- Make buttons max 500px wide on large screens, make them vertically and horizontally responsive on smaller screens
- Make sure the buttons fit its container at all times.

**First button (Top Left):**

- Text & Sub Text: Make it whatever you see fits
- Function: Should send clicker to a room in our game

**Second button (Bottom Right):**

- Text: Change it to whatever you see fits
- Sub Text: Change it to whatever you see fits
- Function: Should use an API from colonist lobby/spectate/leaderboards

- Create hover effects

## Requirements

- Start off from the given code: <https://jsfiddle.net/7wosc24n/>
- Use HTML5 / SCSS / Javascript
- Do not use any external libraries
- Make the code readable and as clean as possible
- Use the given coding style
- Write good, scalable code
- Optimize for good responsive UI and UX
- Confusing parts are left to your initiative (Do whatever is necessary to make the experiment as good as possible)
- Test will be evaluated on Chrome

## Important

- **Perfection is the Baseline:** This project is 100x simpler than our actual codebase. If you cannot achieve perfection here, you will not survive our codebase.
- **Automatic Elimination:** We test your ability to follow instructions. Missing any required element, constraint, or step results in immediate disqualification.
- **Read Carefully:** Review the entire document before starting. Deliver exactly what is requested, nothing less.

## Submission

- Submit your test within 72 hours of receiving the assignment email
- Please send your solution as a reply to the email you received with the following subject line: `[Colonist] Take-Home Assignment`
- Submit a jsfiddle link
- In HTML box, add comments, explaining your thought process on your choices for the project
- Free to use AI as it will be part of the job. You are expected to state what you used and where
- Include the time it took you to complete it on the file rather than the email
- You possibly will be asked for an iteration

If you have any questions, please contact Paula (<paula@colonist.io>) via email. Good luck, and we're excited to see your work!

---

## Reference: Original starter code (from <https://jsfiddle.net/7wosc24n/>)

```html
<div class="button-left-top">
  <span>Button1</span>
</div>
<div class="button-right-bottom">
  <span>Button2</span>
</div>
```

```scss
$blue: #0084ff;
$blue-darker: darken($blue, 5);

body {
  background: #20262E;
  padding: 20px;
  font-family: Helvetica;
}

.button-left-top {
  position: absolute;
  margin-left: 20px;
  margin-top: 20px;
  width: 100px;
  height: 50px;
  background: #fff;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-bottom-right-radius: 20px;
  border-bottom-left-radius: 20px;
  text-align: center;

  &:hover {
    background: $blue-darker;
    color: #fff;
    margin-top: 20px;
    width: 100px;
  }
}

.button-right-bottom {
  position: absolute;
  margin-left: 170px;
  margin-top: 100px;
  width: 100px;
  height: 50px;
  background: #fff;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-bottom-right-radius: 20px;
  border-bottom-left-radius: 20px;
  text-align: center;

  span { margin: auto; }

  &:hover {
    background: $blue-darker;
    color: #fff;
    margin-top: 100px;
    width: 100px;
  }
}
```

```javascript
function buttonTwoAction() {
  let apiResult = getAPIResult();
}

function getAPIResult() {
  return 'resultPlaceholder';
}
```
