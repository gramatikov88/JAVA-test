import { GoogleGenAI, Type, Schema } from "@google/genai";
import { QuizConfig, GeneratedQuestion, SimulationResult, TaskType, ExamResult } from '../types';

const getClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment");
  }
  return new GoogleGenAI({ apiKey });
};

// The System Prompt provided by the user for Senior Java Developer persona
const SENIOR_JAVA_DEV_PROMPT = `
You are an expert Senior Java Developer and Code Reviewer specialized in Clean Code and Code Style standards (Google Java Style Guide / Oracle Conventions).

Your goal is to reformat the user's Java code to maximize readability, focusing specifically on **layout, indentation, and spacing**.

**STRICT FORMATTING RULES:**
1.  **Indentation:**
    - Use exactly 4 SPACES for each level of indentation. Do NOT use tabs.
    - Ensure nested blocks (if, for, while) are strictly indented relative to their parent.
2.  **Brace Style (K&R / Egyptian):**
    - Opening braces \`{\` must be on the same line as the declaration.
    - Closing braces \`}\` must be on their own line, aligned with the start of the block statement.
3.  **Line Wrapping & Length:**
    - Hard limit: 120 characters per line.
    - **Method Chaining (Streams/Builders):** Put each method call on a new line, starting with the dot \`.\`. Align the dots vertically.
    - **Long Arguments:** If arguments exceed line length, break them into new lines, aligned with the opening parenthesis \`(\`.
    - **Operators:** Break lines *before* binary operators (e.g., \`+\`, \`&&\`, \`||\`), not after.
4.  **Whitespace (Breathing Room):**
    - Add a single space around all operators (\`=\`, \`+\`, \`==\`, \`->\`).
    - Add a single space after keywords like \`if\`, \`for\`, \`while\`, \`catch\` before the opening parenthesis.
    - Add a single space after commas in lists.
5.  **Vertical Spacing:**
    - Insert exactly one blank line between methods.
    - Insert one blank line inside methods to separate logical blocks (e.g., between variable declarations and logic).

**FILL-IN-THE-BLANK SYSTEM INSTRUCTION:**
You are an intelligent coding assistant helping a user complete a Java "fill-in-the-blanks" exercise.

The user provided code snippet containing placeholders. These placeholders are marked in two ways:
1. Text surrounded by underscores (e.g., \`_int___\`, \`_a_\`, \`______\`).
2. Visual boxes indicating missing values.

**YOUR PRIMARY GOAL:**
When evaluating, generating, or correcting code involving blanks:
When the user provides an input value for a blank, you must replace the **ENTIRE** placeholder with that value.

**STRICT CONSTRAINTS FOR REPLACEMENT:**
1.  **REMOVE ALL UNDERSCORES:** You must delete all leading and trailing underscores belonging to the placeholder.
2.  **CLEAN OUTPUT:** The final result must contain ONLY the user's typed value in that position, with correct normal spacing around it. No remnant underscores should remain.

**EXAMPLES:**
* **Input Code:** \`_int___ age = 25;\` -> **User Types:** \`int\` -> **CORRECT Output:** \`int age = 25;\`
* **Input Code:** \`______ temperature = 36.6;\` -> **User Types:** \`double\` -> **CORRECT Output:** \`double temperature = 36.6;\`
`;

// Schema for generating questions
const questionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A short title for the problem" },
    instructions: { type: Type.STRING, description: "Clear instructions for the student on what to do" },
    codeSnippet: { type: Type.STRING, description: "The Java code following the formatting rules. For 'Fill in the Blank', use '____' (4 underscores) as placeholders. For 'Bug Fix', include logic or syntax errors." },
    solution: { type: Type.STRING, description: "The fully correct, working Java code following the formatting rules." },
    explanation: { type: Type.STRING, description: "A brief explanation of the concept being tested." }
  },
  required: ["title", "instructions", "codeSnippet", "solution", "explanation"]
};

// Schema for validating/simulating code
const simulationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    output: { type: Type.STRING, description: "The simulated console output of the code. If there is a compilation error, put the error message here." },
    isCorrect: { type: Type.BOOLEAN, description: "Whether the code solves the problem as requested." },
    feedback: { type: Type.STRING, description: "Constructive feedback for the student, including notes on code style/formatting if applicable." }
  },
  required: ["output", "isCorrect", "feedback"]
};

// Schema for final exam grading
const examSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    grade: { type: Type.INTEGER, description: "The final grade on a scale of 2 to 6." },
    label: { type: Type.STRING, description: "Label like 'Excellent', 'Good', 'Poor', etc." },
    feedback: { type: Type.STRING, description: "Detailed justification for the grade." },
    styleScore: { type: Type.INTEGER, description: "0-100 score for indentation and formatting." },
    correctnessScore: { type: Type.INTEGER, description: "0-100 score for functionality." }
  },
  required: ["grade", "label", "feedback", "styleScore", "correctnessScore"]
};

const cleanCode = (code: string): string => {
  return code
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    // Intelligently remove empty lines but keep paragraph separation
    .replace(/^\s*[\r\n]/gm, '\n') 
    .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines into 2
    .trim();
};

export const generateQuestion = async (config: QuizConfig): Promise<GeneratedQuestion> => {
  const ai = getClient();
  
  const prompt = `
    Create a Java programming task.
    Difficulty: ${config.difficulty}
    Topic: ${config.topic}
    Type: ${config.taskType}
    Language: ${config.language} (The instructions and title must be in this language).
    
    CRITICAL CODE GENERATION RULES:
    1. The 'codeSnippet' must be PURE Java code.
    2. STRICTLY FORBIDDEN: Do NOT include ANY comments (// or /* */). No instructions inside the code.
    3. The code must be cleanly formatted according to the System Instructions (4 spaces, K&R braces).
    4. If Type is 'Fill in the Blank', use exactly '____' (4 underscores).
    5. If Type is 'Bug Fix', provide code with subtle errors but NO comments pointing them out.
    
    Ensure the code is self-contained (e.g., inside a Main class main method).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: SENIOR_JAVA_DEV_PROMPT, 
      responseMimeType: 'application/json',
      responseSchema: questionSchema,
      temperature: 0.7 
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  const data = JSON.parse(text) as Omit<GeneratedQuestion, 'initialCode'>;
  
  // Double-check cleaning
  const cleanedSnippet = cleanCode(data.codeSnippet);

  return {
    ...data,
    codeSnippet: cleanedSnippet,
    initialCode: cleanedSnippet
  };
};

export const simulateJavaCode = async (
  userCode: string, 
  originalQuestion: GeneratedQuestion,
  language: string
): Promise<SimulationResult> => {
  const ai = getClient();

  const prompt = `
    Act as a Java Compiler and Tutor.
    
    Task Instructions: ${originalQuestion.instructions}
    Expected Solution Pattern: ${originalQuestion.solution}
    
    Student's Code:
    \`\`\`java
    ${userCode}
    \`\`\`
    
    1. Simulate the execution of the Student's Code.
    2. Determine if it successfully accomplishes the task.
    3. Provide the output (stdout) or compiler errors.
    4. Provide feedback in ${language}.
       - Check if the code runs correctly.
       - Also briefly check if the student maintained the Coding Style (indentation, spacing) defined in your System Instructions.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: SENIOR_JAVA_DEV_PROMPT, 
      responseMimeType: 'application/json',
      responseSchema: simulationSchema,
      temperature: 0.2 
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  return JSON.parse(text) as SimulationResult;
};

export const gradeExam = async (
  userCode: string,
  originalQuestion: GeneratedQuestion,
  metrics: { timeSpentSeconds: number; attempts: number },
  language: string
): Promise<ExamResult> => {
  const ai = getClient();

  const prompt = `
    Act as a Strict Computer Science Teacher grading a student exam.
    
    GRADING SCALE (Bulgarian System):
    6 = Excellent (Perfect correct code, perfect style, efficiency)
    5 = Very Good (Correct code, minor style or efficiency issues)
    4 = Good (Correct logic but messy, or took too many attempts)
    3 = Fair (Partial solution or major errors)
    2 = Poor (Does not run, logic failed completely)

    Student Performance Data:
    - Task: ${originalQuestion.instructions}
    - Correct Solution: ${originalQuestion.solution}
    - Student Code: \`\`\`java ${userCode} \`\`\`
    - Time Taken: ${metrics.timeSpentSeconds} seconds
    - Attempts (Runs): ${metrics.attempts}
    
    Evaluation Criteria:
    1. **Functionality (Highest Weight)**: Does it solve the problem?
    2. **Formatting & Style**: Are indents correct (4 spaces)? Are brackets correct? Is it readable?
    3. **Efficiency**: Did they take too long (>120s for simple tasks is slow)? Did they spam the "Run" button (>5 attempts is bad)?

    Respond in ${language}.
    Calculate 'grade' (integer 2-6).
    Calculate 'styleScore' (0-100).
    Calculate 'correctnessScore' (0-100).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: SENIOR_JAVA_DEV_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: examSchema,
      temperature: 0.4
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  return JSON.parse(text) as ExamResult;
};