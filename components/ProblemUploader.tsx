import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import type { ProblemInput } from '../types';
import Icon from './Icon';
import CtaGuard from './CtaGuard';

interface ProblemUploaderProps {
  onProblemSubmit: (problem: ProblemInput) => void;
  isAnalyzing: boolean;
  isProMode: boolean;
  onProModeChange: (isPro: boolean) => void;
}

const ICONS = {
    upload: "M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z",
    camera: "M2 8v10h20V8h-5.072l-1.724-1.724A2 2 0 0013.78 5.5H10.22a2 2 0 00-1.424.776L7.072 8H2zM12 16a4 4 0 110-8 4 4 0 010 8z",
    questionMark: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
};

// Helper function to get cropped image data
function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string
): Promise<{ file: File; url: string }> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.floor(crop.width);
  canvas.height = Math.floor(crop.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.reject(new Error('Canvas context is not available.'));
  }

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        const url = URL.createObjectURL(file);
        resolve({ file, url });
      },
      'image/jpeg',
      0.95
    );
  });
}

const ProblemUploader: React.FC<ProblemUploaderProps> = ({ onProblemSubmit, isAnalyzing, isProMode, onProModeChange }) => {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Cropping state
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const originalFileNameRef = useRef<string>('cropped-image.jpeg');

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));
        if (imageItem) {
            const blob = imageItem.getAsFile();
            if (blob) {
                event.preventDefault(); // Prevent default paste behavior

                // Create a new file object from the blob
                const file = new File([blob], `pasted-${Date.now()}.png`, { type: blob.type });

                // Revoke the old object URL to prevent memory leaks
                if (imagePreview) {
                    URL.revokeObjectURL(imagePreview);
                }

                // Set the new file and create a new preview URL
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
                setError(null);
            }
        }
    };

    window.addEventListener('paste', handlePaste);

    return () => {
        window.removeEventListener('paste', handlePaste);
    };
  }, [imagePreview]);
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일(PNG, JPG 등)만 업로드할 수 있습니다.');
        return;
      }
      setError(null);
      originalFileNameRef.current = file.name;
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropSource(reader.result as string);
        setCrop(undefined); 
        setCompletedCrop(undefined);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = "";
  };
  
  const handleSubmit = useCallback(() => {
    if (!text && !imageFile) {
      setError('문제 내용 또는 이미지 파일을 업로드해주세요.');
      return;
    }
    setError(null);

    const problem: ProblemInput = { text };

    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        problem.image = {
          mimeType: imageFile.type,
          data: base64String,
        };
        onProblemSubmit(problem);
      };
      reader.readAsDataURL(imageFile);
    } else {
      onProblemSubmit(problem);
    }
  }, [text, imageFile, onProblemSubmit]);
  
  const removeImage = () => {
    if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
    if(cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleCropCancel = () => {
    setCropSource(null);
  };
  
  const handleCropConfirm = useCallback(async () => {
    if (completedCrop && imgRef.current && completedCrop.width > 0 && completedCrop.height > 0) {
        try {
            const { file, url } = await getCroppedImg(
                imgRef.current,
                completedCrop,
                originalFileNameRef.current
            );
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
            setImageFile(file);
            setImagePreview(url);
            setCropSource(null);
        } catch (e) {
            console.error(e);
            setError("이미지를 자르는 중 오류가 발생했습니다.");
            setCropSource(null);
        }
    }
  }, [completedCrop, imagePreview]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    const fullCrop: Crop = {
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100
    };
    setCrop(fullCrop);
    setCompletedCrop({
        unit: 'px',
        x: 0,
        y: 0,
        width: width,
        height: height,
    });
  };

  return (
    <>
      {cropSource && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 p-4 crop-modal-fade-in">
          <div className="bg-white p-4 rounded-lg shadow-xl max-w-3xl w-full flex flex-col">
            <h3 className="text-xl font-bold mb-4 text-center text-gray-800">이미지 자르기</h3>
            <div className="flex justify-center items-center bg-gray-900 rounded overflow-hidden">
                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={undefined}
                >
                    <img
                        ref={imgRef}
                        src={cropSource}
                        alt="Crop target"
                        onLoad={onImageLoad}
                    />
                </ReactCrop>
            </div>
            <div className="mt-6 flex justify-center space-x-4">
                <button 
                  onClick={handleCropConfirm} 
                  disabled={!completedCrop?.width || !completedCrop?.height}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  자르기 완료
                </button>
                <button onClick={handleCropCancel} className="px-6 py-2 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">
                  취소
                </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">풀이랩(PulyLab) - 과학</h1>
          <p className="text-gray-600 mt-2">스스로 답을 찾는 여정, AI 튜터와 함께 시작해봐요!</p>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-4 rounded-md mb-6" role="alert">
          <p className="font-bold">업로드 안내</p>
          <p>정확한 풀이를 위해 한 번에 한 문제만 올려주세요.</p>
          <p>문제 내용을 직접 입력하거나, 캡쳐 또는 촬영한 이미지 파일을 업로드해주세요. </p>
        </div>

        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="여기에 문제 내용을 직접 입력하거나 클립보드에서 이미지를 붙여넣으세요."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            disabled={isAnalyzing}
          />

          <div className="flex space-x-4">
            <label htmlFor="dropzone-file" className={`flex-1 flex flex-col items-center justify-center h-40 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 transition ${isAnalyzing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-100'}`}>
                <div className="flex flex-col items-center justify-center text-center px-2">
                    <Icon path={ICONS.upload} className="w-8 h-8 mb-3 text-gray-500" />
                    <p className="mb-1 text-sm text-gray-500 font-semibold">문제 사진 업로드</p>
                    <p className="text-xs text-gray-500">클릭하여 이미지 선택</p>
                </div>
            </label>
            <input id="dropzone-file" type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isAnalyzing} />

            <label htmlFor="camera-file" className={`flex-1 flex flex-col items-center justify-center h-40 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 transition ${isAnalyzing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-100'}`}>
                <div className="flex flex-col items-center justify-center text-center px-2">
                    <Icon path={ICONS.camera} className="w-8 h-8 mb-3 text-gray-500" />
                    <p className="mb-1 text-sm text-gray-500 font-semibold">카메라로 촬영</p>
                    <p className="text-xs text-gray-500">모바일 기기 전용</p>
                </div>
            </label>
            <input id="camera-file" type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} disabled={isAnalyzing} />
          </div>

          {imagePreview && (
            <div className="mt-4 p-2 border rounded-lg relative">
              <img src={imagePreview} alt="Problem preview" className="max-h-60 w-auto mx-auto rounded" />
              <button onClick={removeImage} aria-label="이미지 삭제" className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center">&times;</button>
            </div>
          )}
          
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center relative group mr-3">
                <label 
                    htmlFor="pro-mode-toggle-btn" 
                    className={`text-sm font-medium transition-colors ${isAnalyzing ? 'text-gray-400' : 'text-gray-700 cursor-pointer'}`}
                    onClick={() => !isAnalyzing && onProModeChange(!isProMode)}
                >
                    Pro 분석 모드
                </label>
                <button
                    type="button"
                    aria-label="Pro 분석 모드 설명 보기"
                    className="ml-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors"
                >
                    <Icon path={ICONS.questionMark} className="w-4 h-4" />
                </button>
                
                <div className="absolute bottom-full right-0 mb-2 w-max max-w-[50vw] sm:max-w-xs p-2.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none z-10">
                    높은 난이도의 수능 문제와 같이 복잡하고 여러 단계의 풀이가 필요한 문제에만 사용을 권장해요. gemini-2.5-pro를 사용하여 분석 시간이 길어집니다.
                    <div className="absolute top-full right-3 w-0 h-0 border-x-4 border-x-transparent border-t-[6px] border-t-gray-800"></div>
                </div>
            </div>
            
            <button 
              type="button"
              id="pro-mode-toggle-btn"
              onClick={() => onProModeChange(!isProMode)} 
              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed ${isProMode ? 'bg-blue-600' : 'bg-gray-300'}`}
              aria-pressed={isProMode}
              disabled={isAnalyzing}
            >
              <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isProMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <CtaGuard>
            <button
              onClick={handleSubmit}
              disabled={isAnalyzing || (!text && !imageFile)}
              className="w-full p-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors duration-300 flex items-center justify-center"
            >
              {isAnalyzing ? '분석 중...' : '풀이 시작하기'}
            </button>
          </CtaGuard>
        </div>
      </div>
    </>
  );
};

export default ProblemUploader;
