const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const cors = require('cors');

// Activer CORS pour toutes les routes
app.use(cors());

// Middleware pour parser les données JSON
app.use(bodyParser.json());

// Configuration de la connexion à la base de données PostgreSQL

const pool = new Pool({
    user: 'urbiimzyajypiaak85ms',
    host: 'bq6hhe5uadgymark8ejl-postgresql.services.clever-cloud.com',
    database: 'bq6hhe5uadgymark8ejl',
    password: 'KDMuFDlF9kyQ949iQxur',
    port: 5433,
  });

// const pool = new Pool({
//   user: 'postgres',
//   host: 'localhost',
//   database: 'elearning_db',
//   password: 'admin',
//   port: 5432,
// });

/***************************************************************************************************************************************** */
  //endpoint pour l'inscription
app.post('/api/register', async (req, res) => {
    const { username, password, first_name, last_name , email } = req.body;
  
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUserQuery = 'SELECT * FROM authentication_utilisateur WHERE username = $1';
      const existingUserValues = [username];
      const existingUserResult = await pool.query(existingUserQuery, existingUserValues);
  
      if (existingUserResult.rows.length > 0) {
        return res.status(409).json({status:"error", message: 'Ce nom d\'utilisateur est déjà utilisé.' });
      }
  
      // Générer une référence unique pour l'utilisateur
      const reference = generateReference();
  
      // Hasher le mot de passe avec bcrypt
      const hashedPassword = bcrypt.hashSync(password, 10);
  
      // Insérer le nouvel utilisateur dans la base de données
      const insertUserQuery = 'INSERT INTO authentication_utilisateur (username, password, first_name, last_name,email, reference) VALUES ($1, $2, $3, $4, $5, $6)';
      const insertUserValues = [username, hashedPassword, first_name, last_name,  email , reference];
      await pool.query(insertUserQuery, insertUserValues);
  
      res.json({ message: 'Utilisateur crée avec succès !' });
    } catch (error) {
      console.error('Erreur lors de l\'inscription :', error);
      res.status(500).json({ message: 'Une erreur est survenue lors de l\'inscription.' });
    }
  });

  /*************************************************************************************************************************************** */
//end point de connexion
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      // Rechercher l'utilisateur dans la base de données
      const getUserQuery = 'SELECT * FROM authentication_utilisateur WHERE username = $1';
      const getUserValues = [username];
      const userResult = await pool.query(getUserQuery, getUserValues);
      const user = userResult.rows[0];
  
      // Vérifier si l'utilisateur existe et si le mot de passe est valide
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
      }
  
      res.json({ message: 'Connexion réussie !' , data: user });
    } catch (error) {
      console.error('Erreur lors de la connexion :', error);
      res.status(500).json({ message: 'Une erreur est survenue lors de la connexion.' });
    }
  });

/******************************************************************************************************************************************* */
  // Endpoint pour l'enregistrement d'un cours
  app.post('/api/create/cours', (req, res) => {
    const { title, description, chapters } = req.body;
  
    const insertCourseQuery = `
      INSERT INTO cours_course (title, description)
      VALUES ($1, $2)
      RETURNING id
    `;
  
    const insertCourseValues = [title, description];
  
    pool.query(insertCourseQuery, insertCourseValues)
      .then((courseResult) => {
        const courseId = courseResult.rows[0].id;
  
        const chapterPromises = chapters.map((chapter) => {
          const { title, description, subsections, quiz } = chapter;
  
          const insertChapterQuery = `
            INSERT INTO cours_chapter (course_id, title, description)
            VALUES ($1, $2, $3)
            RETURNING id
          `;
  
          const insertChapterValues = [courseId, title, description];
  
          return pool.query(insertChapterQuery, insertChapterValues)
            .then((chapterResult) => {
              const chapterId = chapterResult.rows[0].id;
  
              const subsectionPromises = subsections.map((subsection) => {
                const { title, content } = subsection;
  
                const insertSubsectionQuery = `
                  INSERT INTO cours_subsection (chapter_id, title, content)
                  VALUES ($1, $2, $3)
                `;
  
                const insertSubsectionValues = [chapterId, title, content];
  
                return pool.query(insertSubsectionQuery, insertSubsectionValues);
              });
  
              const questionPromises = quiz.questions.map((question) => {
                const { statement, options } = question;
  
                const insertQuestionQuery = `
                  INSERT INTO cours_question (statement, chapter_id)
                  VALUES ($1, $2)
                  RETURNING id
                `;
  
                const insertQuestionValues = [statement, chapterId];
  
                return pool.query(insertQuestionQuery, insertQuestionValues)
                  .then((questionResult) => {
                    const questionId = questionResult.rows[0].id;
  
                    const optionPromises = options.map((option) => {
                      const { text, isCorrect } = option;
  
                      const insertOptionQuery = `
                        INSERT INTO cours_option (question_id, text, is_correct)
                        VALUES ($1, $2, $3)
                      `;
  
                      const insertOptionValues = [questionId, text, isCorrect];
  
                      return pool.query(insertOptionQuery, insertOptionValues);
                    });
  
                    return Promise.all(optionPromises);
                  });
              });
  
              return Promise.all([...subsectionPromises, ...questionPromises]);
            });
        });
  
        Promise.all(chapterPromises)
        .then(() => {
          // Calcul du nombre de chapitres
          const nombreChapitres = chapters.length;
      
          // Calcul du nombre de parties
          const nombreParties = nombreChapitres * 2;
      
          // Calcul du pourcentage de progression par partie
          const pourcentageProgression = 100 / nombreParties;
      
          // Insertion de la progression dans la table cours_progression
          const insertProgressionQuery = `
            INSERT INTO cours_progression (course_id, nombre_parties, pourcentage_progression)
            VALUES ($1, $2, $3)
          `;
      
          const insertProgressionValues = [courseId, nombreParties, pourcentageProgression];
      
          return pool.query(insertProgressionQuery, insertProgressionValues);
        })
          .then(() => {
            res.json({ message: 'Cours enregistré avec succès' });
          })
          .catch((error) => {
            console.error('Erreur lors de l\'enregistrement du cours:', error);
            res.status(400).json({ message: 'Erreur lors de l\'enregistrement du cours' });
          });
      })
      .catch((error) => {
        console.error('Erreur lors de l\'enregistrement du cours:', error);
        res.status(400).json({ message: 'Erreur lors de l\'enregistrement du cours' });
      });
  });
  
/************************************************************************************************************************************ */
// traitement du quiz
// Route POST /quiz
app.post('/api/quiz', (req, res) => {
  // Récupérer les réponses du quiz depuis le corps de la requête
  console.log(req.body)
  const userAnswers = req.body.answers;
  console.log(userAnswers);
  const quizData = req.body.quiz
  console.log(quizData)
  // Calculer le pourcentage de réussite
  const totalQuestions = quizData.questions.length;
  let correctAnswers = 0;
let correctOptions = 0;
  // for (let i = 0; i < totalQuestions; i++) {
  //   const correctOptions = quizData.questions[i].options
  //     .filter(option => option.is_correct)
  //     .map(option => option.text);

  //   const userSelectedOptions = userAnswers[i] || [];

  //   if (arraysMatch(correctOptions, userSelectedOptions)) {
  //     correctAnswers++;
  //   }
  // }
//   for (let i = 0; i < totalQuestions; i++) {
//     correctOptions = quizData.questions[i].options
//       .filter(option => option.is_correct)
//       .map(option => option.text);

//     const userSelectedOptions = userAnswers[i] || [];
//     console.log(userSelectedOptions)
//     if (arraysMatch(correctOptions, userSelectedOptions)) {
//       correctAnswers++;
//     }
//   }
//  // console.Consolelog(correctOptions)
//   console.log(correctOptions)
//   const successPercentage = (correctAnswers / totalQuestions) * 100;


 // Récupérer les index des bonnes réponses pour chaque question
 const correctAnswersIndexes = quizData.questions.map(question => {
  const correctAnswerIndex = question.options.findIndex(option => option.is_correct);
  return correctAnswerIndex;
});

console.log(correctAnswersIndexes);
console.log(userAnswers)
let correctAnswer = 0;


for (let i = 0; i < correctAnswersIndexes.length; i++) {
  if (correctAnswersIndexes[i] === userAnswers[i][0]) {
    correctAnswer++;
  }
}
console.log(correctAnswer);
console.log(totalQuestions)

//const successPercentage = (correctAnswer / totalQuestions) * 100;
const successPercentage = Math.floor((correctAnswer / totalQuestions) * 100);

console.log(successPercentage)
  // Répondre avec le pourcentage de réussite
  res.json({ successPercentage });
});
/*************************************************************************************************************************************** */
//recuperer les cours de la base de donnée
app.get('/api/user/dashboard/', async(req, res) => {

  try {
    const query = `
      SELECT c.id AS cours_id, c.title AS cours_title, c.description AS cours_description,
             ch.title AS chapter_title, ch.description AS chapter_description,
             s.title AS subsection_title, s.content AS subsection_content,
             q.statement AS question_statement,
             o.text AS option_text, o.is_correct AS option_is_correct
      FROM cours_course AS c
      JOIN cours_chapter AS ch ON c.id = ch.course_id
      JOIN cours_subsection AS s ON ch.id = s.chapter_id
      JOIN cours_question AS q ON ch.id = q.chapter_id
      JOIN cours_option AS o ON q.id = o.question_id
      ORDER BY RANDOM()
      LIMIT 3
    `;
    const result = await pool.query(query);
  
    const coursAleatoires = [];
  
    result.rows.forEach(row => {
      const {
        cours_id,
        cours_title,
        cours_description,
        chapter_title,
        chapter_description,
        subsection_title,
        subsection_content,
        question_statement,
        option_text,
        option_is_correct
      } = row;
  
      let existingCours = coursAleatoires.find(cours => cours.title === cours_title);
  
      if (!existingCours) {
        existingCours = {
          id: cours_id,
          title: cours_title,
          description: cours_description,
          chapters: []
        };
        coursAleatoires.push(existingCours);
      }
  
      let existingChapter = existingCours.chapters.find(chapter => chapter.title === chapter_title);
  
      if (!existingChapter) {
        existingChapter = {
          title: chapter_title,
          description: chapter_description,
          subsections: [],
          quiz: {
            questions: []
          }
        };
        existingCours.chapters.push(existingChapter);
      }
  
      let existingSubsection = existingChapter.subsections.find(subsection => subsection.title === subsection_title);
  
      if (!existingSubsection) {
        existingSubsection = {
          title: subsection_title,
          content: subsection_content
        };
        existingChapter.subsections.push(existingSubsection);
      }
  
      let existingQuestion = existingChapter.quiz.questions.find(question => question.statement === question_statement);
  
      if (!existingQuestion) {
        existingQuestion = {
          statement: question_statement,
          options: []
        };
        existingChapter.quiz.questions.push(existingQuestion);
      }
  
      existingQuestion.options.push({
        text: option_text,
        is_correct: option_is_correct
      });
    });
  
    // Tri des chapitres et sous-sections par ordre alphabétique
    coursAleatoires.forEach(cours => {
      cours.chapters.sort((a, b) => a.title.localeCompare(b.title));
      cours.chapters.forEach(chapter => {
        chapter.subsections.sort((a, b) => a.title.localeCompare(b.title));
      });
    });
  
    res.json(coursAleatoires);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Une erreur est survenue' });
  }
});

/****************************************************************************************************************************************** */

//rechercher un cours par son id

app.post('/api/cours/search_by_id/', async (req, res) => {
  const { courId } = req.body;
  try {
    const query = `
        SELECT DISTINCT o.id AS option_id,
        c.id AS cours_id, c.title AS cours_title, c.description AS cours_description,
        ch.id AS chapter_id, ch.title AS chapter_title, ch.description AS chapter_description,
        s.title AS subsection_title, s.content AS subsection_content,
        q.statement AS question_statement,
        o.text AS option_text, o.is_correct AS option_is_correct
    FROM cours_course AS c
    JOIN cours_chapter AS ch ON c.id = ch.course_id
    JOIN cours_subsection AS s ON ch.id = s.chapter_id
    JOIN cours_question AS q ON ch.id = q.chapter_id
    JOIN cours_option AS o ON q.id = o.question_id
    WHERE c.id = $1
    `;
    const value = [courId];
    const result = await pool.query(query, value);

    const coursAleatoires = [];

    result.rows.forEach(row => {
      const {
        cours_id,
        cours_title,
        cours_description,
        chapter_id,
        chapter_title,
        chapter_description,
        subsection_title,
        subsection_content,
        question_statement,
        option_id,
        option_text,
        option_is_correct
      } = row;

      let existingCours = coursAleatoires.find(cours => cours.id === cours_id);

      if (!existingCours) {
        existingCours = {
          id: cours_id,
          title: cours_title,
          description: cours_description,
          chapters: []
        };
        coursAleatoires.push(existingCours);
      }

      let existingChapter = existingCours.chapters.find(chapter => chapter.id === chapter_id);

      if (!existingChapter) {
        existingChapter = {
          id: chapter_id,
          title: chapter_title,
          description: chapter_description,
          subsections: [],
          quiz: {
            questions: []
          }
        };
        existingCours.chapters.push(existingChapter);
      }

      let existingSubsection = existingChapter.subsections.find(subsection => subsection.title === subsection_title);

      if (!existingSubsection) {
        existingSubsection = {
          title: subsection_title,
          content: subsection_content
        };
        existingChapter.subsections.push(existingSubsection);
      }

      let existingQuestion = existingChapter.quiz.questions.find(question => question.statement === question_statement);

      if (!existingQuestion) {
        existingQuestion = {
          statement: question_statement,
          options: []
        };
        existingChapter.quiz.questions.push(existingQuestion);
      }

      // Vérifier si l'option avec le même ID existe déjà
      const existingOption = existingQuestion.options.find(option => option.id === option_id);

      if (!existingOption) {
        existingQuestion.options.push({
          id: option_id,
          text: option_text,
          is_correct: option_is_correct
        });
      }
    });

    res.json(coursAleatoires);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Une erreur est survenue' });
  }
});
/****************************************************************************************************************************************** */
//rechercher un cours par son titre
//rechercher un cours par son id

app.get('/api/cours/search_by_id/', async(req, res) => {
  const { courId } = req.body;
  try {
      const query = `
        SELECT c.title AS cours_title, c.description AS cours_description,
               ch.title AS chapter_title, ch.description AS chapter_description,
               s.title AS subsection_title, s.content AS subsection_content,
               q.statement AS question_statement,
               o.text AS option_text, o.is_correct AS option_is_correct
        FROM cours_course AS c
        JOIN cours_chapter AS ch ON c.id = ch.course_id
        JOIN cours_subsection AS s ON ch.id = s.chapter_id
        JOIN cours_question AS q ON ch.id = q.chapter_id
        JOIN cours_option AS o ON q.id = o.question_id
        WHERE c.title  = $1
      `;
      const value = [ courId]
      const result = await pool.query(query , value);
  
      const coursAleatoires = [];
  
      result.rows.forEach(row => {
        const {
          cours_id,
          cours_title,
          cours_description,
          chapter_title,
          chapter_description,
          subsection_title,
          subsection_content,
          question_statement,
          option_text,
          option_isCorrect
        } = row;
  
        let existingCours = coursAleatoires.find(cours => cours.title === cours_title);
  
        if (!existingCours) {
          existingCours = {
            id: cours_id,
            title: cours_title,
            description: cours_description,
            chapters: []
          };
          coursAleatoires.push(existingCours);
        }
  
        let existingChapter = existingCours.chapters.find(chapter => chapter.title === chapter_title);
  
        if (!existingChapter) {
          existingChapter = {
            title: chapter_title,
            description: chapter_description,
            subsections: [],
            quiz: {
              questions: []
            }
          };
          existingCours.chapters.push(existingChapter);
        }
  
        let existingSubsection = existingChapter.subsections.find(subsection => subsection.title === subsection_title);
  
        if (!existingSubsection) {
          existingSubsection = {
            title: subsection_title,
            content: subsection_content
          };
          existingChapter.subsections.push(existingSubsection);
        }
  
        let existingQuestion = existingChapter.quiz.questions.find(question => question.statement === question_statement);
  
        if (!existingQuestion) {
          existingQuestion = {
            statement: question_statement,
            options: []
          };
          existingChapter.quiz.questions.push(existingQuestion);
        }
  
        existingQuestion.options.push({
          text: option_text,
          is_correct: option_isCorrect
        });
      });
  
      // Tri des chapitres et sous-sections par ordre alphabétique
      coursAleatoires.forEach(cours => {
        cours.chapters.sort((a, b) => a.title.localeCompare(b.title));
        cours.chapters.forEach(chapter => {
          chapter.subsections.sort((a, b) => a.title.localeCompare(b.title));
        });
      });
  
      res.json(coursAleatoires);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Une erreur est survenue' });
    }
  });

/****************************************************************************************************************************************** */
// Route pour créer un suivi de cours pour un utilisateur
app.post('/api/suivi-cours', async (req, res) => {
    try {
      const { utilisateurId, coursId  } = req.body;
      let date = new Date()
  
      // Insérer un nouveau suivi de cours dans la base de données
      const query = 'INSERT INTO cours_courssuivi (date_debut , utilisateur_id, cours_id, progression) VALUES ($1, $2,  $3, 0) RETURNING *';
      const values = [date , utilisateurId, coursId];
      const result = await pool.query(query, values);
  
      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Une erreur est survenue' });
    }
  });
  

/*************************************************************************************************************************************** */
  // Route pour mettre à jour la progression d'un suivi de cours
  app.post('/api/update-cours-suivi', async (req, res) => {
    try {
      //const { id } = req.params;
      const { progression ,chapter, users , courId , quiz_done} = req.body;
  
      // Mettre à jour la progression du suivi de cours dans la base de données
      const query = 'UPDATE cours_courssuivi SET progression = $1, chapter_id = $2 , quiz_done = $5 WHERE utilisateur_id = $3 AND cours_id = $4 RETURNING *';
      const values = [progression,chapter, users ,  courId , quiz_done];
      const result = await pool.query(query, values);
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Suivi de cours introuvable' });
      }
  
      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Une erreur est survenue' });
    }
  });

  // Route pour mettre à jour la progression d'un suivi de cours apres un quiz
  app.post('/api/update-cours-suivi-after-quiz', async (req, res) => {
    try {
      //const { id } = req.params;
      const { progression ,quiz_done, users , courId } = req.body;
  
      // Mettre à jour la progression du suivi de cours dans la base de données
      const query = 'UPDATE cours_courssuivi SET progression = $1 , quiz_done= $2 WHERE utilisateur_id = $3 AND cours_id = $4 RETURNING *';
      const values = [progression,quiz_done, users ,  courId ];
      const result = await pool.query(query, values);
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Suivi de cours introuvable' });
      }
  
      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Une erreur est survenue' });
    }
  });

/***************************************************************************************************************************************** */
// Route pour obtenir la liste des cours suivis par un utilisateur
app.post('/api/cours-suivis/', async (req, res) => {
    try {
      // const { utilisateurId } = req.params;
      const { utilisateurId} = req.body;
      // Requête pour récupérer les cours suivis par l'utilisateur
      const query = `
        SELECT cours_course.id, cours_course.title, cours_course.description, cours_courssuivi.progression , cours_courssuivi.date_debut
        FROM cours_course
        INNER JOIN cours_courssuivi ON cours_course.id = cours_courssuivi.cours_id
        WHERE cours_courssuivi.utilisateur_id = $1
      `;
      const values = [utilisateurId];
      const result = await pool.query(query, values);
  
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Une erreur est survenue' });
    }
  });
  /*************************************************************************************************************************** */
  //endpoin pour obtenir la liste des cours
  app.get('/api/all-courses', async (req, res) => {
    try {
      const query = `
        SELECT c.id AS cours_id, c.title AS cours_title, c.description AS cours_description,
               ch.title AS chapter_title, ch.description AS chapter_description, ch.id AS chapter_id,
               s.title AS subsection_title, s.content AS subsection_content , s.id AS subsection_id,
               q.statement AS question_statement,
               o.text AS option_text, o.is_correct AS option_is_correct
        FROM cours_course AS c
        JOIN cours_chapter AS ch ON c.id = ch.course_id
        JOIN cours_subsection AS s ON ch.id = s.chapter_id
        JOIN cours_question AS q ON ch.id = q.chapter_id
        JOIN cours_option AS o ON q.id = o.question_id
      `;
      const result = await pool.query(query);
    
      const coursAleatoires = [];
    
      result.rows.forEach(row => {
        const {
          cours_id,
          cours_title,
          cours_description,
          chapter_id,
          chapter_title,
          chapter_description,
          subsection_id,
          subsection_title,
          subsection_content,
          question_statement,
          option_text,
          option_is_correct
        } = row;
    
        let existingCours = coursAleatoires.find(cours => cours.title === cours_title);
    
        if (!existingCours) {
          existingCours = {
            id: cours_id,
            title: cours_title,
            description: cours_description,
            chapters: []
          };
          coursAleatoires.push(existingCours);
        }
    
        let existingChapter = existingCours.chapters.find(chapter => chapter.title === chapter_title);
    
        if (!existingChapter) {
          existingChapter = {
            id:chapter_id,
            title: chapter_title,
            description: chapter_description,
            subsections: [],
            quiz: {
              questions: []
            }
          };
          existingCours.chapters.push(existingChapter);
        }
    
        let existingSubsection = existingChapter.subsections.find(subsection => subsection.title === subsection_title);
    
        if (!existingSubsection) {
          existingSubsection = {
            id: subsection_id,
            title: subsection_title,
            content: subsection_content
          };
          existingChapter.subsections.push(existingSubsection);
        }
    
        let existingQuestion = existingChapter.quiz.questions.find(question => question.statement === question_statement);
    
        if (!existingQuestion) {
          existingQuestion = {
            statement: question_statement,
            options: []
          };
          existingChapter.quiz.questions.push(existingQuestion);
        }
    
        existingQuestion.options.push({
          text: option_text,
          is_correct: option_is_correct
        });
      });
    
      // Tri des chapitres et sous-sections par ordre alphabétique
      coursAleatoires.forEach(cours => {
        cours.chapters.sort((a, b) => a.title.localeCompare(b.title));
        cours.chapters.forEach(chapter => {
          chapter.subsections.sort((a, b) => a.title.localeCompare(b.title));
        });
      });
    
      res.json(coursAleatoires);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: 'Une erreur est survenue' });
    }
  });
/************************************************************************************************************************************ */
//recuperer le niveau d'avancement d'un cours pour un utilisateur
app.post('/api/cours-pourcentage', async (req, res) => {
  const {courId, utilisateurId} = req.body;
  try {
    const query = `
      SELECT progression , chapter_id , quiz_done
      FROM cours_courssuivi WHERE utilisateur_id = $1 AND cours_id= $2;
    `;
    const value = [  utilisateurId , courId]
    const result = await pool.query(query , value);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Une erreur est survenue' });
  }
});
/************************************************************************************************************************************ */
//recuperer le pourcentage de progression  d'un cours 
app.post('/api/cours-progression', async (req, res) => {
  const {courId } = req.body;
  try {
    const query = `
      SELECT nombre_parties, pourcentage_progression
      FROM cours_progression WHERE  course_id= $1;
    `;
    const value = [courId]
    const result = await pool.query(query , value);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Une erreur est survenue' });
  }
});
/**************************************************************************************************************************** */
//listre des utilisateurs

app.get('/api/users', async (req, res) => {
  try {
    const query = `
      SELECT * FROM authentication_utilisateur;
    `;
    const result = await pool.query(query);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Une erreur est survenue' });
  }
});
/***************************************************************************************************************************** */
//route pour modifier un utilisateur
app.post('/api/edit-users/', async (req, res) => {
  const {id, first_name, last_name ,email, username , is_admin } = req.body;

  try {
    const query = `
      UPDATE authentication_utilisateur
      SET first_name = $1, email = $2, last_name = $3 ,username = $4  ,is_admin = $5
      WHERE id = $6
      RETURNING *;
    `;
    const values = [first_name, email,last_name , username , is_admin, id];
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Une erreur est survenue' });
  }
});
  /*****************************************************9***************************************************************************** */

  // Route pour obtenir la liste des utilisateurs et leur niveau d'avancement dans les cours
app.get('/utilisateurs-avancement', async (req, res) => {
    try {
      // Requête pour récupérer la liste des utilisateurs et leur niveau d'avancement
      const query = `
        SELECT authentication_utilisateur.id, authentication_utilisateur.nom, authentication_utilisateur.prenom, suivi_cours.cours_id, suivi_cours.progression , cours_course.title
        FROM authentication_utilisateur , cours_course
        INNER JOIN suivi_cours ON utilisateur.id = suivi_cours.utilisateur_id
        INNER JOIN suivi_cours ON cours_course.id = suivi_cours.cours_id
      `;
      const result = await pool.query(query);
  
      // Structure des données de sortie
      const utilisateursAvancement = {};
  
      // Parcourir les résultats de la requête
      result.rows.forEach(row => {
        const { id, nom, prenom, cours_id, progression } = row;
        
        // Vérifier si l'utilisateur existe dans la structure de données
        if (!utilisateursAvancement[id]) {
          utilisateursAvancement[id] = {
            id,
            nom,
            prenom,
            cours: []
          };
        }
  
        // Ajouter le cours et sa progression à l'utilisateur correspondant
        utilisateursAvancement[id].cours.push({
          cours_id,
          progression
        });
      });
  
      res.json(utilisateursAvancement);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Une erreur est survenue' });
    }
  });

/************************************************************************************************************ */
// Endpoint pour la suppression d'un cours

app.post('/api/delete-course', async (req, res) => {
  //const courseId = req.params.courseId;
  const {courseId } = req.body;
  try {
    // Suppression des sections liées aux chapitres
    const deleteSectionsQuery = `
      DELETE FROM cours_subSection
      WHERE chapter_id IN (
        SELECT id
        FROM cours_chapter
        WHERE course_id = $1
      );
    `;
    const deleteSectionsValues = [courseId];
    await pool.query(deleteSectionsQuery, deleteSectionsValues);

    // supression des options lié a une question 
    const deleteOptionQuery = `
    DELETE FROM cours_option
    WHERE question_id IN (
      SELECT id
      FROM cours_question
      WHERE chapter_id IN (
        SELECT id
        FROM cours_chapter
        WHERE course_id = $1
      )
    );
  `;
  const deleteOptionValues = [courseId];
  await pool.query(deleteOptionQuery, deleteOptionValues);


    // Suppression des questions liées au chapitre
    const deleteQuestionsQuery = `
      DELETE FROM cours_question
      WHERE chapter_id IN (
        SELECT id
        FROM cours_chapter
        WHERE course_id = $1
      );
    `;
    const deleteQuestionsValues = [courseId];
    await pool.query(deleteQuestionsQuery, deleteQuestionsValues);

    
    // Suppression des chapitres liés au cours
    const deleteChaptersQuery = `
      DELETE FROM cours_chapter
      WHERE course_id = $1;
    `;
    const deleteChaptersValues = [courseId];
    await pool.query(deleteChaptersQuery, deleteChaptersValues);

    // Suppression du cours dans la table cours progression
    const deleteProgressionQuery = `
      DELETE FROM cours_progression
      WHERE course_id = $1;
    `;
    const deleteProgressionValues = [courseId];
    await pool.query(deleteProgressionQuery, deleteProgressionValues);


    // Suppression du cours dans la table cours suivi
    const deleteSuiciQuery = `
      DELETE FROM cours_courssuivi
      WHERE cours_id = $1;
    `;
    const deleteSuiviValues = [courseId];
    await pool.query(deleteSuiciQuery, deleteSuiviValues);

    // Suppression du cours lui-même
    const deleteCourseQuery = `
      DELETE FROM cours_course
      WHERE id = $1;
    `;
    const deleteCourseValues = [courseId];
    await pool.query(deleteCourseQuery, deleteCourseValues);

    res.json({ message: 'Le cours a été supprimé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Une erreur est survenue lors de la suppression du cours' });
  }
});
/************************************************************************************************************ */
  // Endpoint pour la suppression d'un chapitre
app.post('/api/delete-chapitre', async (req, res) => {
  const {chapitreId} = req.body;

 
  try {
     // supression des options lié a une question 
     const deleteOptionQuery = `
     DELETE FROM cours_option
     WHERE question_id IN (
       SELECT id
       FROM cours_question
       WHERE chapter_id = $1
     );
   `;
   const deleteOptionValues = [chapitreId];
   await pool.query(deleteOptionQuery, deleteOptionValues);

    // Suppression des questions liées au chapitre
    const deleteQuestionsQuery = `
      DELETE FROM cours_question
      WHERE chapter_id = $1;
    `;
    const deleteQuestionsValues = [chapitreId];
    await pool.query(deleteQuestionsQuery, deleteQuestionsValues);

    // Suppression des sections liées au chapitre
    const deleteSectionsQuery = `
      DELETE FROM cours_subsection
      WHERE chapter_id = $1;
    `;
    const deleteSectionValues = [chapitreId];
    await pool.query(deleteSectionsQuery, deleteSectionValues);


    // Suppression du chapitre
    const deleteChapterQuery = `
      DELETE FROM cours_chapter
      WHERE id = $1;
    `;
    const deleteChapterValues = [chapitreId];
    await pool.query(deleteChapterQuery, deleteChapterValues);

    res.json({ message: 'Le chapitre a été supprimé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la suppression du chapitre' });
  }
});
/************************************************************************************************************ */

// Endpoint pour la suppression d'une section
app.post('/api/delete-sections', async (req, res) => {
  const {sectionId} = req.body;

  try {
    const deleteSectionsQuery = `
      DELETE FROM cours_subsection
      WHERE id = $1;
    `;
    const deleteSectionValues = [sectionId];
    await pool.query(deleteSectionsQuery, deleteSectionValues);

    res.status(200).json({ message: 'La section a été supprimée avec succès' });

  } catch (error) {
    res.status(400).json({ error: 'Une erreur est survenue lors de la suppression de la section' });
  }
});

/*********************************************************************************************************** */
/************************************************************************************************************ */

// Endpoint pour la suppression d'un utilisateur
app.post('/api/delete-user', async (req, res) => {
  const {userId} = req.body;

  try {
    const deleteSectionsQuery = `
      DELETE FROM authentication_utilisateur
      WHERE id = $1;
    `;
    const deleteSectionValues = [userId];
    await pool.query(deleteSectionsQuery, deleteSectionValues);

    res.status(200).json({ message: 'Lutilisateur a été supprimé avec succès a été supprimée avec succès' });

  } catch (error) {
    res.status(400).json({ error: "Une erreur est survenue lors de la suppression de l'utilisateur" });
  }
});
// Fonction pour générer une référence unique
function generateReference() {
    const length = 15;
    let reference = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (let i = 0; i < length; i++) {
      reference += characters.charAt(Math.floor(Math.random() * characters.length));
    }
  
    return reference;
  }


  //function pour comparer deux arrays
  function arraysMatch(arr1, arr2) {
    if (arr1.length !== arr2.length) {
      return false;
    }
  
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }
  
    return true;
  }


  //fin api de creation de cours

// Démarrez le serveur
app.listen(8080, () => {
    console.log('Serveur démarré sur le port 3000');
  });