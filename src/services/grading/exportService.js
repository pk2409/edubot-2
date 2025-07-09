// Export Service for generating Excel reports and other export formats

class ExportService {
  generateCSVReport(submissions, sessionInfo) {
    const headers = [
      'Student Name',
      'Roll Number',
      'Class Section',
      'Total Marks',
      'Max Marks',
      'Percentage',
      'Grade',
      'Status',
      'Submission Date',
      'Review Date'
    ];
    
    const rows = submissions.map(submission => [
      submission.student_name || '',
      submission.roll_number || '',
      submission.class_section || '',
      submission.total_marks || 0,
      sessionInfo.question_paper?.total_marks || 0,
      submission.percentage?.toFixed(1) || '0.0',
      submission.grade || '',
      submission.is_reviewed ? 'Reviewed' : 'Pending',
      new Date(submission.created_at).toLocaleDateString(),
      submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleDateString() : ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }

  generateDetailedReport(submissions, analytics, sessionInfo) {
    const report = {
      sessionInfo: {
        name: sessionInfo.session_name,
        subject: sessionInfo.question_paper?.subject,
        totalQuestions: sessionInfo.question_paper?.questions?.length || 0,
        totalMarks: sessionInfo.question_paper?.total_marks || 0,
        createdAt: sessionInfo.created_at,
        completedAt: sessionInfo.completed_at
      },
      summary: {
        totalSubmissions: analytics.totalSubmissions,
        gradedSubmissions: analytics.gradedSubmissions,
        averageScore: analytics.averageScore,
        highestScore: analytics.highestScore,
        lowestScore: analytics.lowestScore,
        gradeDistribution: analytics.gradeDistribution
      },
      studentResults: submissions.map(submission => ({
        studentName: submission.student_name,
        rollNumber: submission.roll_number,
        classSection: submission.class_section,
        totalMarks: submission.total_marks,
        percentage: submission.percentage,
        grade: submission.grade,
        questionWiseMarks: this.extractQuestionWiseMarks(submission),
        teacherFeedback: submission.teacher_feedback,
        submissionDate: submission.created_at,
        reviewDate: submission.reviewed_at
      })),
      questionAnalysis: analytics.questionAnalysis,
      insights: analytics.insights,
      recommendations: this.generateRecommendations(analytics)
    };
    
    return report;
  }

  extractQuestionWiseMarks(submission) {
    if (!submission.final_grades || !submission.final_grades.grades) {
      return [];
    }
    
    return submission.final_grades.grades.map(grade => ({
      questionNumber: grade.questionNumber,
      marks: grade.marks,
      maxMarks: grade.maxMarks,
      percentage: grade.maxMarks > 0 ? (grade.marks / grade.maxMarks * 100) : 0
    }));
  }

  generateRecommendations(analytics) {
    const recommendations = [];
    
    if (analytics.averageScore < 70) {
      recommendations.push({
        type: 'class',
        priority: 'high',
        action: 'Review topic with entire class',
        reason: 'Low class average indicates widespread difficulty'
      });
    }
    
    if (analytics.performanceCategories.needsImprovement > 0) {
      recommendations.push({
        type: 'individual',
        priority: 'high',
        action: 'Provide additional support to struggling students',
        reason: `${analytics.performanceCategories.needsImprovement} students scored below 70%`
      });
    }
    
    const difficultQuestions = analytics.questionAnalysis.filter(q => q.averagePercentage < 60);
    if (difficultQuestions.length > 0) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        action: `Review concepts for questions ${difficultQuestions.map(q => q.questionNumber).join(', ')}`,
        reason: 'These questions had low average scores'
      });
    }
    
    return recommendations;
  }

  downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  downloadJSON(data, filename) {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  generateGradingEfficiencyReport(sessions) {
    const report = {
      totalSessions: sessions.length,
      totalSubmissions: sessions.reduce((sum, session) => sum + session.total_submissions, 0),
      totalGradedSubmissions: sessions.reduce((sum, session) => sum + session.graded_submissions, 0),
      averageGradingTime: this.calculateAverageGradingTime(sessions),
      timeSaved: this.calculateTimeSaved(sessions),
      efficiency: this.calculateEfficiencyMetrics(sessions)
    };
    
    return report;
  }

  calculateAverageGradingTime(sessions) {
    // Simulate grading time calculation
    // In production, this would be based on actual timing data
    const totalSubmissions = sessions.reduce((sum, session) => sum + session.graded_submissions, 0);
    if (totalSubmissions === 0) return 0;
    
    // Assume average of 8 minutes per submission with AI assistance
    return 8; // minutes
  }

  calculateTimeSaved(sessions) {
    const totalSubmissions = sessions.reduce((sum, session) => sum + session.graded_submissions, 0);
    
    // Assume traditional grading takes 25 minutes per submission
    // AI-assisted grading takes 8 minutes per submission
    const traditionalTime = totalSubmissions * 25;
    const aiAssistedTime = totalSubmissions * 8;
    
    return Math.max(0, traditionalTime - aiAssistedTime); // minutes saved
  }

  calculateEfficiencyMetrics(sessions) {
    const totalSubmissions = sessions.reduce((sum, session) => sum + session.graded_submissions, 0);
    const timeSaved = this.calculateTimeSaved(sessions);
    
    return {
      submissionsPerHour: totalSubmissions > 0 ? Math.round(60 / 8) : 0, // Based on 8 min per submission
      timeSavedPercentage: totalSubmissions > 0 ? Math.round((timeSaved / (totalSubmissions * 25)) * 100) : 0,
      productivityIncrease: '3x faster than traditional grading'
    };
  }
}

export default new ExportService();