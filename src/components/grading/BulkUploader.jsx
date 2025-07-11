import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import BulkUploadService from '../../services/grading/bulkUploadService';

const BulkUploader = ({ sessionId, onUploadComplete }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    }
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles) => {
    const { validFiles, errors } = BulkUploadService.validateFiles(newFiles);
    
    if (errors.length > 0) {
      alert('File validation errors:\n' + errors.join('\n'));
    }
    
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    setUploading(true);
    setUploadProgress({ completed: 0, total: files.length, percentage: 0 });

    try {
      // Process files and pass them directly to the upload service
      const results = await BulkUploadService.uploadFiles(
        files, // Just pass the files array
        sessionId,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setUploadResults(results);
      
      if (results.successful > 0) {
        setFiles([]); // Clear files on successful upload
        if (onUploadComplete) {
          onUploadComplete(results);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-lg font-medium text-gray-800 mb-2">
          Upload Student Submissions
        </h3>
        <p className="text-gray-600 mb-4">
          Drag and drop PDF files here, or click to select files
        </p>
        <input
          type="file"
          multiple
          accept=".pdf,image/*"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className={`inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer ${
            uploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Choose Files
        </label>
        <p className="text-sm text-gray-500 mt-2">
          Supported formats: PDF, JPG, PNG (Max 50MB per file)
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-800">
              Selected Files ({files.length})
            </h4>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload All'}
            </button>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file, index) => {
              const { studentName, rollNumber } = BulkUploadService.extractStudentInfo(file.name, index);
              
              return (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <FileText className="text-blue-500 flex-shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{file.name}</div>
                    <div className="text-sm text-gray-600">
                      {studentName} • Roll: {rollNumber} • {formatFileSize(file.size)}
                    </div>
                  </div>
                  {!uploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-800">Upload Progress</span>
            <span className="text-sm text-gray-600">
              {uploadProgress.completed}/{uploadProgress.total} files
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.percentage}%` }}
            ></div>
          </div>
          {uploadProgress.currentFile && (
            <p className="text-sm text-gray-600">
              Uploading: {uploadProgress.currentFile}
            </p>
          )}
        </div>
      )}

      {/* Upload Results */}
      {uploadResults && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-medium text-gray-800 mb-4">Upload Results</h4>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <CheckCircle className="mx-auto text-green-500 mb-1" size={24} />
              <div className="font-bold text-green-800">{uploadResults.successful}</div>
              <div className="text-sm text-green-600">Successful</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <AlertCircle className="mx-auto text-red-500 mb-1" size={24} />
              <div className="font-bold text-red-800">{uploadResults.failed}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>

          {uploadResults.results.some(r => !r.success) && (
            <div className="space-y-2">
              <h5 className="font-medium text-red-800">Failed Uploads:</h5>
              {uploadResults.results
                .filter(r => !r.success)
                .map((result, index) => (
                  <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {result.file}: {result.error}
                  </div>
                ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center text-blue-800 mb-2">
              <Clock size={16} className="mr-2" />
              <span className="font-medium">Next Steps</span>
            </div>
            <div className="text-blue-700 text-sm space-y-1">
              <div>• OCR processing will begin automatically</div>
              <div>• AI grading will start after OCR completion</div>
              <div>• You can monitor progress in the grading interface</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkUploader;