// Analytics Service for grading data analysis

class AnalyticsService {
  calculateSessionAnalytics(submissions) {
    if (!submissions || submissions.length === 0) {
      return this.getEmptyAnalytics();
    }

    const reviewedSubmissions = submissions.filter(sub => sub.is_reviewed);
    
    if (reviewedSubmissions.length === 0) {
      return this.getEmptyAnalytics();
    }

    const scores = reviewedSubmissions.map(sub => sub.percentage || 0);
    const totalMarks = reviewedSubmissions.map(sub => sub.total_marks || 0);
    
    const analytics = {
      totalSubmissions: submissions.length,
      gradedSubmissions: reviewedSubmissions.length,
      pendingSubmissions: submissions.length - reviewedSubmissions.length,
      
      // Score statistics
      averageScore: this.calculateAverage(scores),
      highestScore: Math.max(...scores, 0),
      lowestScore: Math.min(...scores, 100),
      medianScore: this.calculateMedian(scores),
      
      // Grade distribution
      gradeDistribution: this.calculateGradeDistribution(scores),
      
      // Performance categories
      performanceCategories: {
        excellent: scores.filter(s => s >= 90).length,
        good: scores.filter(s => s >= 80 && s < 90).length,
        satisfactory: scores.filter(s => s >= 70 && s < 80).length,
        needsImprovement: scores.filter(s => s < 70).length
      },
      
      // Question-wise analysis
      questionAnalysis: this.analyzeQuestionPerformance(reviewedSubmissions),
      
      // Time analysis
      timeAnalysis: this.analyzeGradingTime(submissions),
      
      // Insights and recommendations
      insights: this.generateInsights(scores, reviewedSubmissions)
    };

    return analytics;
  }

  getEmptyAnalytics() {
    return {
      totalSubmissions: 0,
      gradedSubmissions: 0,
      pendingSubmissions: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      medianScore: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      performanceCategories: {
        excellent: 0,
        good: 0,
        satisfactory: 0,
        needsImprovement: 0
      },
      questionAnalysis: [],
      timeAnalysis: {
        averageGradingTime: 0,
        totalGradingTime: 0,
        efficiency: 'N/A'
      },
      insights: []
    };
  }

  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  calculateMedian(numbers) {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }

  calculateGradeDistribution(scores) {
    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    
    scores.forEach(score => {
      if (score >= 90) distribution.A++;
      else if (score >= 80) distribution.B++;
      else if (score >= 70) distribution.C++;
      else if (score >= 60) distribution.D++;
      else distribution.F++;
    });
    
    return distribution;
  }

  analyzeQuestionPerformance(submissions) {
    if (submissions.length === 0) return [];
    
    // Get the first submission to determine number of questions
    const firstSubmission = submissions[0];
    if (!firstSubmission.final_grades || !firstSubmission.final_grades.grades) {
      return [];
    }
    
    const numQuestions = firstSubmission.final_grades.grades.length;
    const questionAnalysis = [];
    
    for (let i = 0; i < numQuestions; i++) {
      const questionScores = [];
      const questionMaxMarks = [];
      
      submissions.forEach(submission => {
        if (submission.final_grades && submission.final_grades.grades && submission.final_grades.grades[i]) {
          const grade = submission.final_grades.grades[i];
          questionScores.push(grade.marks || 0);
          questionMaxMarks.push(grade.maxMarks || 0);
        }
      });
      
      if (questionScores.length > 0) {
        const maxMarks = questionMaxMarks[0] || 1;
        const averageMarks = this.calculateAverage(questionScores);
        const averagePercentage = (averageMarks / maxMarks) * 100;
        
        questionAnalysis.push({
          questionNumber: i + 1,
          averageMarks: averageMarks,
          maxMarks: maxMarks,
          averagePercentage: averagePercentage,
          difficulty: this.assessQuestionDifficulty(averagePercentage),
          studentsAttempted: questionScores.filter(score => score > 0).length,
          totalStudents: questionScores.length
        });
      }
    }
    
    return questionAnalysis;
  }

  assessQuestionDifficulty(averagePercentage) {
    if (averagePercentage >= 80) return 'Easy';
    if (averagePercentage >= 60) return 'Medium';
    if (averagePercentage >= 40) return 'Hard';
    return 'Very Hard';
  }

  analyzeGradingTime(submissions) {
    const gradedSubmissions = submissions.filter(sub => sub.reviewed_at && sub.created_at);
    
    if (gradedSubmissions.length === 0) {
      return {
        averageGradingTime: 0,
        totalGradingTime: 0,
        efficiency: 'N/A'
      };
    }
    
    const gradingTimes = gradedSubmissions.map(sub => {
      const created = new Date(sub.created_at);
      const reviewed = new Date(sub.reviewed_at);
      return (reviewed - created) / (1000 * 60); // Convert to minutes
    });
    
    const averageTime = this.calculateAverage(gradingTimes);
    const totalTime = gradingTimes.reduce((sum, time) => sum + time, 0);
    
    let efficiency = 'Good';
    if (averageTime < 5) efficiency = 'Excellent';
    else if (averageTime < 10) efficiency = 'Good';
    else if (averageTime < 20) efficiency = 'Fair';
    else efficiency = 'Needs Improvement';
    
    return {
      averageGradingTime: averageTime,
      totalGradingTime: totalTime,
      efficiency: efficiency
    };
  }

  generateInsights(scores, submissions) {
    const insights = [];
    
    if (scores.length === 0) {
      insights.push({
        type: 'info',
        title: 'No Data Available',
        message: 'Start grading submissions to see analytics and insights.'
      });
      return insights;
    }
    
    const averageScore = this.calculateAverage(scores);
    const excellentCount = scores.filter(s => s >= 90).length;
    const needsImprovementCount = scores.filter(s => s < 70).length;
    
    // Performance insights
    if (averageScore >= 85) {
      insights.push({
        type: 'success',
        title: 'Excellent Class Performance',
        message: `The class average of ${averageScore.toFixed(1)}% indicates strong understanding of the material.`
      });
    } else if (averageScore < 70) {
      insights.push({
        type: 'warning',
        title: 'Class Needs Additional Support',
        message: `The class average of ${averageScore.toFixed(1)}% suggests students may need additional help with this topic.`
      });
    }
    
    // Individual performance insights
    if (excellentCount > 0) {
      insights.push({
        type: 'info',
        title: 'High Achievers',
        message: `${excellentCount} student(s) scored 90% or above. Consider providing them with advanced challenges.`
      });
    }
    
    if (needsImprovementCount > 0) {
      insights.push({
        type: 'warning',
        title: 'Students Needing Support',
        message: `${needsImprovementCount} student(s) scored below 70%. Consider providing additional support or remedial sessions.`
      });
    }
    
    // Score distribution insights
    const scoreRange = Math.max(...scores) - Math.min(...scores);
    if (scoreRange > 50) {
      insights.push({
        type: 'info',
        title: 'Wide Performance Range',
        message: 'There\'s a significant variation in student performance. Consider differentiated instruction strategies.'
      });
    }
    
    return insights;
  }

  generateClassReport(analytics, sessionInfo) {
    return {
      sessionName: sessionInfo.session_name,
      subject: sessionInfo.question_paper?.subject,
      generatedAt: new Date().toISOString(),
      summary: {
        totalStudents: analytics.totalSubmissions,
        averageScore: analytics.averageScore,
        passRate: ((analytics.performanceCategories.excellent + 
                   analytics.performanceCategories.good + 
                   analytics.performanceCategories.satisfactory) / 
                   analytics.totalSubmissions * 100),
        topPerformers: analytics.performanceCategories.excellent,
        needsSupport: analytics.performanceCategories.needsImprovement
      },
      recommendations: this.generateRecommendations(analytics),
      analytics: analytics
    };
  }

  generateRecommendations(analytics) {
    const recommendations = [];
    
    if (analytics.averageScore < 70) {
      recommendations.push('Consider reviewing the topic with the entire class');
      recommendations.push('Provide additional practice materials');
    }
    
    if (analytics.performanceCategories.needsImprovement > 0) {
      recommendations.push('Schedule remedial sessions for struggling students');
      recommendations.push('Implement peer tutoring programs');
    }
    
    if (analytics.performanceCategories.excellent > 0) {
      recommendations.push('Provide advanced challenges for high achievers');
      recommendations.push('Consider having top performers help struggling classmates');
    }
    
    // Question-specific recommendations
    const difficultQuestions = analytics.questionAnalysis.filter(q => q.averagePercentage < 60);
    if (difficultQuestions.length > 0) {
      recommendations.push(`Review questions ${difficultQuestions.map(q => q.questionNumber).join(', ')} - students found these challenging`);
    }
    
    return recommendations;
  }
}

export default new AnalyticsService();