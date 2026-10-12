/**
 * PG 2025 Semester 1 Calculation
 *
 * INPUT:
 *   utils/pg2025Sem1Students.json
 *
 * OUTPUT:
 *   utils/pg2025Sem1Calculated.json
 *
 * INPUT FORMAT:
 *   Raw foil JSON
 *
 * OUTPUT FORMAT:
 *   PG semester result structure
 *
 * CALCULATION:
 *
 * THEORY:
 *   Total = Midsem + Final
 *
 * PRACTICAL:
 *   Total = Final / Practical Mark
 *
 * Percentage:
 *   Total / FullMark × 100
 *
 * Credit Point:
 *   Credit × Grade Point
 *
 * SGPA:
 *   Total Credit Point / Total Credit
 *
 * GRADE:
 *   90-100 = O  = 10
 *   80-89  = A+ = 9
 *   70-79  = A  = 8
 *   60-69  = B+ = 7
 *   50-59  = B  = 6
 *   45-49  = C  = 5
 *   40-44  = D  = 4
 *   Below 40 = F = 0
 *
 * IMPORTANT:
 *   The raw input JSON is NOT modified.
 *   Student ObjectId is NOT generated here.
 *   It will be attached later by looking up the student
 *   from the 2025 PG batch collection.
 */

const fs = require("fs");
const path = require("path");

const pg2025Sem1Config =
  require("./pg2025Sem1Config");

const ROOT = path.join(__dirname, "..");

const INPUT_FILE =
  process.argv[2] ||
  path.join(
    ROOT,
    "utils",
    "pg2025Sem1Students.json"
  );

const OUTPUT_FILE =
  process.argv[3] ||
  path.join(
    ROOT,
    "utils",
    "pg2025Sem1Calculated.json"
  );


/* =========================================================
   BASIC HELPERS
========================================================= */

function isBlank(value) {
  return (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  );
}


function parseMark(value) {
  if (isBlank(value)) {
    return {
      kind: "blank",
      value: 0,
      raw: value
    };
  }

  const text = String(value).trim();
  const upper = text.toUpperCase();


  /* -------------------------------------------------------
     ABSENT
  ------------------------------------------------------- */

  if (
    upper === "AB" ||
    upper === "A.B" ||
    upper === "ABSENT"
  ) {
    return {
      kind: "AB",
      value: 0,
      raw: text
    };
  }


  /* -------------------------------------------------------
     MALPRACTICE
  ------------------------------------------------------- */

  if (
    upper === "M" ||
    upper === "MP" ||
    upper === "M.P"
  ) {
    return {
      kind: "M",
      value: 0,
      raw: text
    };
  }


  /* -------------------------------------------------------
     NUMBER
  ------------------------------------------------------- */

  const number = Number(text);

  if (Number.isFinite(number)) {
    return {
      kind: "number",
      value: number,
      raw: text
    };
  }


  /* -------------------------------------------------------
     UNKNOWN
  ------------------------------------------------------- */

  return {
    kind: "other",
    value: 0,
    raw: text
  };
}


function round2(value) {
  return Math.round(value * 100) / 100;
}


/* =========================================================
   DEPARTMENT
========================================================= */

function normalizeDepartment(department) {
  const value = String(department || "")
    .trim()
    .toLowerCase();

  const aliases = {
    odia: "Odia",
    chemistry: "Chemistry",
    math: "Math",
    mathematics: "Math",
    commerce: "Commerce",
    geology: "Geology",
    mfc: "MFC"
  };

  return aliases[value] || department;
}


/* =========================================================
   PAPER CONFIG
========================================================= */

function getPaperConfig(
  department,
  paperCode,
  paperIndex
) {
  const normalizedDepartment =
    normalizeDepartment(department);

  const departmentConfig =
    pg2025Sem1Config.departments?.[
      normalizedDepartment
    ];

  if (!departmentConfig) {
    return null;
  }

  const code =
    String(paperCode || "")
      .trim()
      .toLowerCase();


  /* -------------------------------------------------------
     FIRST: EXACT PAPER CODE MATCH
  ------------------------------------------------------- */

  const exact =
    (departmentConfig.papers || []).find(
      (paper) =>
        String(paper.code || "")
          .trim()
          .toLowerCase() === code
    );

  if (exact) {
    return exact;
  }


  /* -------------------------------------------------------
     FALLBACK: PAPER POSITION
  ------------------------------------------------------- */

  return (
    departmentConfig.papers?.[paperIndex] ||
    null
  );
}


/* =========================================================
   GRADE
========================================================= */

function gradeFromPercentage(percentage) {
  const scale =
    pg2025Sem1Config.grading?.scale || [];

  const found =
    scale.find(
      (item) =>
        percentage >= Number(item.minPercentage) &&
        percentage <= Number(item.maxPercentage)
    );

  if (!found) {
    return {
      grade: "F",
      gradePoint: 0
    };
  }

  return {
    grade: found.grade,
    gradePoint: Number(found.gradePoint)
  };
}


/* =========================================================
   STUDENT HELPERS
========================================================= */

function getCollegeRollNo(student) {
  return (
    student.collegeRollNo ||
    student.CollegeRollNo ||
    student["College Roll No."] ||
    ""
  );
}


function getAutonomousRollNo(student) {
  return (
    student.autonomousRollNo ||
    student.AutonomousRollNo ||
    student["Autonomous Roll No."] ||
    ""
  );
}


function getName(student) {
  return (
    student.name ||
    student.Name ||
    student.applicantName ||
    student["Name of the Students"] ||
    ""
  );
}


function getDepartment(student) {
  return String(
    student.department ||
    student.Department ||
    ""
  ).trim();
}


function getExamCode(student) {
  return (
    student.examcode ||
    student.Examcode ||
    student["Exam Code"] ||
    ""
  );
}


/* =========================================================
   PAPER HELPERS
========================================================= */

function getPaperCode(paper) {
  if (
    paper.paper &&
    typeof paper.paper === "object"
  ) {
    return String(
      paper.paper.code ||
      paper.paper.Code ||
      ""
    ).trim();
  }

  return String(
    paper.paper ||
    paper.courseType ||
    paper.code ||
    paper.Paper ||
    ""
  ).trim();
}


function getPaperTitle(paper) {
  if (
    paper.paper &&
    typeof paper.paper === "object"
  ) {
    return String(
      paper.paper.title ||
      paper.paper.Title ||
      ""
    ).trim();
  }

  return String(
    paper.subjectName ||
    paper.title ||
    paper.Subject ||
    paper.paper ||
    ""
  ).trim();
}


function getMidsem(paper) {
  return (
    paper.midsemMark ??
    paper.midsem ??
    paper.MidsemMark ??
    paper["Midsem-Mark"] ??
    null
  );
}


function getFinalMark(paper) {
  return (
    paper.finalMark ??
    paper.endsem ??
    paper.FinalMark ??
    paper["Final-Mark"] ??
    null
  );
}


/* =========================================================
   MARK FORMATTER
========================================================= */

/**
 * Existing PG result documents store:
 *
 * midsemMark -> String
 * finalMark  -> String
 * totalMark  -> String
 * gradePoint -> String
 *
 * while:
 *
 * marks       -> Number
 * credit      -> Number
 * creditPoint -> Number
 */

function formatMarkForDB(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}


/* =========================================================
   PAPER CALCULATION
========================================================= */

function calculatePaper(
  paper,
  department,
  paperIndex
) {
  const rawPaperCode =
    getPaperCode(paper);

  const rawPaperTitle =
    getPaperTitle(paper);

  const config =
    getPaperConfig(
      department,
      rawPaperCode,
      paperIndex
    );

  if (!config) {
    throw new Error(
      `No configuration found for ${department} - ${
        rawPaperCode || rawPaperTitle
      } (paper ${paperIndex + 1})`
    );
  }


  /* -------------------------------------------------------
     BASIC CONFIG
  ------------------------------------------------------- */

  const fullMark =
    Number(config.fullMark);

  const credit =
    Number(config.credit);

  if (
    !Number.isFinite(fullMark) ||
    fullMark <= 0
  ) {
    throw new Error(
      `Invalid fullMark for ${department} - ${config.code}`
    );
  }

  if (
    !Number.isFinite(credit) ||
    credit <= 0
  ) {
    throw new Error(
      `Invalid credit for ${department} - ${config.code}`
    );
  }


  /* -------------------------------------------------------
     MARKS
  ------------------------------------------------------- */

  const mid =
    parseMark(
      getMidsem(paper)
    );

  const final =
    parseMark(
      getFinalMark(paper)
    );


  /* -------------------------------------------------------
     ABSENT / MALPRACTICE
  ------------------------------------------------------- */

  if (
    mid.kind === "AB" ||
    final.kind === "AB"
  ) {
    return {
      credit,

      creditPoint: 0,

      midsemMark:
        formatMarkForDB(
          mid.kind === "AB"
            ? mid.raw
            : mid.kind === "number"
            ? mid.value
            : ""
        ),

      finalMark:
        formatMarkForDB(
          final.kind === "AB"
            ? final.raw
            : final.kind === "number"
            ? final.value
            : ""
        ),

      totalMark: "",

      marks: null,

      grade: "AB",

      gradePoint: "0",

      paper: {
        code:
          config.code ||
          rawPaperCode,

        title:
          config.title ||
          rawPaperTitle
      }
    };
  }


  if (
    mid.kind === "M" ||
    final.kind === "M"
  ) {
    return {
      credit,

      creditPoint: 0,

      midsemMark:
        formatMarkForDB(
          mid.kind === "M"
            ? mid.raw
            : mid.kind === "number"
            ? mid.value
            : ""
        ),

      finalMark:
        formatMarkForDB(
          final.kind === "M"
            ? final.raw
            : final.kind === "number"
            ? final.value
            : ""
        ),

      totalMark: "",

      marks: null,

      grade: "M",

      gradePoint: "0",

      paper: {
        code:
          config.code ||
          rawPaperCode,

        title:
          config.title ||
          rawPaperTitle
      }
    };
  }


  /* -------------------------------------------------------
     FINAL MARK REQUIRED
  ------------------------------------------------------- */

  if (final.kind !== "number") {
    return {
      credit,

      creditPoint: 0,

      midsemMark:
        formatMarkForDB(
          mid.kind === "number"
            ? mid.value
            : ""
        ),

      finalMark: "",

      totalMark: "",

      marks: null,

      grade: "F",

      gradePoint: "0",

      paper: {
        code:
          config.code ||
          rawPaperCode,

        title:
          config.title ||
          rawPaperTitle
      }
    };
  }


  /* -------------------------------------------------------
     TOTAL MARK
  ------------------------------------------------------- */

  let total;

  if (
    config.type === "practical"
  ) {

    /*
     * Practical:
     *
     * The raw JSON stores the practical
     * mark inside finalMark.
     *
     * Example:
     * ICP-1 = 48 / 50
     */

    total =
      final.value;

  } else {

    /*
     * Theory:
     *
     * Total = Midsem + Final
     */

    const midValue =
      mid.kind === "number"
        ? mid.value
        : 0;

    total =
      midValue +
      final.value;
  }


  total =
    round2(total);


  /* -------------------------------------------------------
     PERCENTAGE
  ------------------------------------------------------- */

  const percentage =
    round2(
      (total / fullMark) * 100
    );


  /* -------------------------------------------------------
     GRADE
  ------------------------------------------------------- */

  const {
    grade,
    gradePoint
  } =
    gradeFromPercentage(
      percentage
    );


  /* -------------------------------------------------------
     CREDIT POINT
  ------------------------------------------------------- */

  const creditPoint =
    round2(
      credit * gradePoint
    );


  /* -------------------------------------------------------
     DB-SHAPED SUBJECT
  ------------------------------------------------------- */

  return {
    credit,

    creditPoint,

    midsemMark:
      formatMarkForDB(
        mid.kind === "number"
          ? mid.value
          : ""
      ),

    finalMark:
      formatMarkForDB(
        final.kind === "number"
          ? final.value
          : ""
      ),

    totalMark:
      formatMarkForDB(
        total
      ),

    marks:
      total,

    grade,

    gradePoint:
      String(gradePoint),

   courses: [
  {
    subjectName:
      config.title ||
      rawPaperTitle,

    courseType:
      config.code ||
      rawPaperCode
  }
]
  };
}


/* =========================================================
   STUDENT CALCULATION
========================================================= */

function calculateStudent(student) {

  const department =
    getDepartment(student);

  const normalizedDepartment =
    normalizeDepartment(
      department
    );


  /* -------------------------------------------------------
     RAW PAPERS
  ------------------------------------------------------- */

  const papers =
    student.courses ||
    student.Papers ||
    student.subjects ||
    [];

  if (!Array.isArray(papers)) {
    throw new Error(
      `Invalid courses format for ${getCollegeRollNo(student)}`
    );
  }

  if (!papers.length) {
    throw new Error(
      `No papers found for ${getCollegeRollNo(student)}`
    );
  }


  /* -------------------------------------------------------
     CALCULATE SUBJECTS
  ------------------------------------------------------- */

  const subjects =
    papers.map(
      (paper, index) =>
        calculatePaper(
          paper,
          department,
          index
        )
    );


  /* -------------------------------------------------------
     TOTALS
  ------------------------------------------------------- */

  let totalCredits = 0;

  let totalCreditPoints = 0;

  let grandTotal = 0;

  let totalMaximumMarks = 0;


  for (const subject of subjects) {

    totalCredits +=
      Number(
        subject.credit || 0
      );

    totalCreditPoints +=
      Number(
        subject.creditPoint || 0
      );


    /*
     * Only numeric subjects are included
     * in the marks total.
     */

    if (
      subject.marks !== null &&
      subject.marks !== undefined &&
      Number.isFinite(
        Number(subject.marks)
      )
    ) {

      grandTotal +=
        Number(subject.marks);

      /*
       * fullMark is not stored in the
       * DB-shaped subject object.
       *
       * We get it again from config.
       */
      const subjectCode =
        subject.paper?.code;

      const config =
        getPaperConfig(
          normalizedDepartment,
          subjectCode,
          subjects.indexOf(subject)
        );

      if (config) {
        totalMaximumMarks +=
          Number(
            config.fullMark || 0
          );
      }
    }
  }


  grandTotal =
    round2(grandTotal);


  totalCreditPoints =
    round2(totalCreditPoints);


  /* -------------------------------------------------------
     SGPA
  ------------------------------------------------------- */

  const sgpa =
    totalCredits > 0
      ? round2(
          totalCreditPoints /
          totalCredits
        )
      : 0;


  /* -------------------------------------------------------
     SEMESTER PERCENTAGE
  ------------------------------------------------------- */

  const percentage =
    totalMaximumMarks > 0
      ? round2(
          (
            grandTotal /
            totalMaximumMarks
          ) * 100
        )
      : 0;


  /* -------------------------------------------------------
     DB RESULT DOCUMENT
  ------------------------------------------------------- */

  return {

    /*
     * student ObjectId is intentionally NOT added here.
     *
     * It will be attached later by the DB insertion
     * script using autonomousRollNo.
     */

    autonomousRollNo:
      getAutonomousRollNo(student),

    semester:
      student.semester ?? 1,

    examcode:
      String(
        getExamCode(student)
      ),

    subjects,

    grandTotal:
      String(grandTotal),

    percentage,

    sgpa
  };
}


/* =========================================================
   MAIN
========================================================= */

function main() {

  console.log(
    "\n=============================================="
  );

  console.log(
    "       PG 2025 SEMESTER 1 CALCULATION"
  );

  console.log(
    "==============================================\n"
  );


  console.log(
    "Input :",
    INPUT_FILE
  );

  console.log(
    "Output:",
    OUTPUT_FILE
  );


  /* -------------------------------------------------------
     CHECK INPUT
  ------------------------------------------------------- */

  if (!fs.existsSync(INPUT_FILE)) {

    console.error(
      "\nInput file not found:"
    );

    console.error(
      INPUT_FILE
    );

    process.exit(1);
  }


  /* -------------------------------------------------------
     READ INPUT
  ------------------------------------------------------- */

  let raw;

  try {

    raw =
      JSON.parse(
        fs.readFileSync(
          INPUT_FILE,
          "utf8"
        )
      );

  } catch (error) {

    console.error(
      "\nInvalid JSON:"
    );

    console.error(
      error.message
    );

    process.exit(1);
  }


  /* -------------------------------------------------------
     GET STUDENTS
  ------------------------------------------------------- */

  const students =
    Array.isArray(raw)
      ? raw
      : raw.students || [];


  if (!students.length) {

    console.error(
      "\nNo students found."
    );

    process.exit(1);
  }


  console.log(
    `Students found: ${students.length}\n`
  );


  /* -------------------------------------------------------
     CALCULATE
  ------------------------------------------------------- */

  let calculated = [];


  try {

    calculated =
      students.map(
        (student, index) => {

          console.log(
            `${index + 1}/${students.length} | ` +
            `${getCollegeRollNo(student)} | ` +
            `${getName(student)}`
          );

          return calculateStudent(
            student
          );
        }
      );

  } catch (error) {

    console.error(
      "\n=============================================="
    );

    console.error(
      "CALCULATION ERROR"
    );

    console.error(
      "=============================================="
    );

    console.error(
      error.message
    );

    process.exit(1);
  }


  /* -------------------------------------------------------
     CREATE OUTPUT DIRECTORY
  ------------------------------------------------------- */

  fs.mkdirSync(
    path.dirname(OUTPUT_FILE),
    {
      recursive: true
    }
  );


  /* -------------------------------------------------------
     WRITE OUTPUT
  ------------------------------------------------------- */

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      calculated,
      null,
      2
    ),
    "utf8"
  );


  /* -------------------------------------------------------
     STATISTICS
  ------------------------------------------------------- */

  const totalStudents =
    calculated.length;


  const failedStudents =
    calculated.filter(
      (student) =>
        student.subjects.some(
          (subject) =>
            subject.grade === "F" ||
            subject.grade === "AB" ||
            subject.grade === "M"
        )
    ).length;


  const passedStudents =
    totalStudents -
    failedStudents;


  /* -------------------------------------------------------
     FINAL LOG
  ------------------------------------------------------- */

  console.log(
    "\n=============================================="
  );

  console.log(
    "CALCULATION COMPLETED"
  );

  console.log(
    "=============================================="
  );

  console.log(
    `Students : ${totalStudents}`
  );

  console.log(
    `PASS     : ${passedStudents}`
  );

  console.log(
    `FAIL     : ${failedStudents}`
  );

  console.log(
    `Output   : ${OUTPUT_FILE}`
  );

  console.log(
    "\nDone."
  );
}


/* =========================================================
   RUN
========================================================= */

if (
  require.main === module
) {
  main();
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  calculatePaper,
  calculateStudent,
  normalizeDepartment,
  getPaperConfig,
  gradeFromPercentage
};