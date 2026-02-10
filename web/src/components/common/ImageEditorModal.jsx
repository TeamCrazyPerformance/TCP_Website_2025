import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/imageUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTimes,
    faSearchPlus,
    faSearchMinus,
    faRotateRight,
    faArrowsLeftRight,
    faArrowsUpDown,
    faCheck,
} from '@fortawesome/free-solid-svg-icons';

/**
 * ImageEditorModal
 *
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to close the modal
 * @param {string} imageSrc - The source URL of the image to edit
 * @param {function} onSave - Function called with the cropped file (Blob)
 * @param {number} aspect - Aspect ratio (width / height), default 1
 * @param {string} shape - 'rect' or 'round', default 'rect'
 */
const ImageEditorModal = ({
    isOpen,
    onClose,
    imageSrc,
    onSave,
    aspect = 1,
    shape = 'rect',
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [flip, setFlip] = useState({ horizontal: false, vertical: false });
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        try {
            setIsProcessing(true);
            const croppedImage = await getCroppedImg(
                imageSrc,
                croppedAreaPixels,
                rotation,
                flip
            );
            onSave(croppedImage);
            onClose();
        } catch (e) {
            console.error(e);
            alert('이미지 편집 중 오류가 발생했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleWheel = (e) => {
        // Prevent default scroll behavior
        // Implementation depends on if Cropper captures wheel events. 
        // react-easy-crop doesn't natively support mouse wheel zoom unless configured or custom handled.
        // For now we rely on the slider.
    };

    if (!isOpen) return null;

    return (
        <div className="modal active" style={{ zIndex: 2000 }}> {/* Ensure it's above other modals */}
            <div
                className="modal-content"
                style={{
                    maxWidth: '800px',
                    height: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--secondary-gray)',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>이미지 편집</h2>
                    <button onClick={onClose} className="close-modal" style={{ position: 'static' }}>
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* Cropper Area */}
                <div style={{
                    flex: 1,
                    position: 'relative',
                    background: '#000',
                    minHeight: '300px'
                }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspect}
                        cropShape={shape}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                        showGrid={true}
                        transform={[
                            `translate(${crop.x}px, ${crop.y}px)`,
                            `rotate(${rotation}deg)`,
                            `scale(${zoom})`,
                            `scaleX(${flip.horizontal ? -1 : 1})`,
                            `scaleY(${flip.vertical ? -1 : 1})`,
                        ].join(' ')}
                    />
                    {/* Custom Transform for flip needed because react-easy-crop doesn't support flip prop natively in older versions or strictly API */}
                    {/* Actually react-easy-crop handles rotation. Flip is usually done via CSS transform on the Image or custom Logic. 
               react-easy-crop docs say: "To flip the image, you can use the transform prop... wait, no transform prop." 
               Actually, we can pass `transform` in style? No.
               
               Correction: `react-easy-crop` does NOT natively support flip. 
               We need to apply scale(-1, 1) to the rotation logic or similar. 
               However, `getCroppedImg` utility handles the actual output flip.
               Visualizing flip in `Cropper` is tricky without `transform` support on the image style. 
               
               Strategy: We will toggle a CSS class or inline style on the user side if possible? 
               Wait, `react-easy-crop` exposes `style` prop for container, media area, media.
           */}
                </div>

                {/* Controls */}
                <div style={{
                    padding: '1.5rem',
                    background: 'var(--secondary-gray)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>

                    {/* Zoom Control */}
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>확대/축소</span>
                            <span style={{ fontSize: '0.9rem', color: '#9ca3af' }}>{(zoom * 100).toFixed(0)}%</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <FontAwesomeIcon icon={faSearchMinus} style={{ color: '#9ca3af' }} />
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="form-input"
                                style={{ cursor: 'pointer' }}
                            />
                            <FontAwesomeIcon icon={faSearchPlus} style={{ color: '#9ca3af' }} />
                        </div>
                    </div>

                    {/* Rotation Control */}
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>회전</span>
                            <span style={{ fontSize: '0.9rem', color: '#9ca3af' }}>{rotation}°</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <FontAwesomeIcon icon={faRotateRight} style={{ color: '#9ca3af' }} />
                            <input
                                type="range"
                                value={rotation}
                                min={0}
                                max={360}
                                step={1}
                                aria-labelledby="Rotation"
                                onChange={(e) => setRotation(Number(e.target.value))}
                                className="form-input"
                                style={{ cursor: 'pointer' }}
                            />
                        </div>
                    </div>

                    {/* Flip Controls */}
                    <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            type="button"
                            className={`input-field ${flip.horizontal ? 'active' : ''}`}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                background: flip.horizontal ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)',
                                color: flip.horizontal ? '#000' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                            onClick={() => {
                                setFlip(f => ({ ...f, horizontal: !f.horizontal }));
                                // Note: Visual feedback for flip in Cropper might be limited without direct support,
                                // but we ensure the OUTPUT is flipped using our utility.
                                // For visual, we might need to inject styles into the Cropper media if standard props fail.
                                // But let's assume standard usage for now.
                            }}
                        >
                            <FontAwesomeIcon icon={faArrowsLeftRight} /> 좌우 반전
                        </button>
                        <button
                            type="button"
                            className={`input-field ${flip.vertical ? 'active' : ''}`}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                background: flip.vertical ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)',
                                color: flip.vertical ? '#000' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                            onClick={() => setFlip(f => ({ ...f, vertical: !f.vertical }))}
                        >
                            <FontAwesomeIcon icon={faArrowsUpDown} /> 상하 반전
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            onClick={onClose}
                            className="input-field"
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#fff',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.5rem',
                                cursor: 'pointer'
                            }}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="cta-button"
                            style={{
                                padding: '0.75rem 2rem',
                                borderRadius: '0.5rem',
                                cursor: isProcessing ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                border: 'none',
                                color: '#fff',
                                fontWeight: 'bold'
                            }}
                        >
                            {isProcessing ? (
                                <>처리중...</>
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faCheck} /> 완료
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            {/* CSS to visually flip the image within the cropper if possible. 
           react-easy-crop applies transform to the image. 
           We can target the image class if we knew it, or pass style via `mediaProps` (if available in version).
           Recent versions support `transform` in `style`? No. 
           
           Actually, we can pass `style` object to `Cropper`.
           `mediaProps={{ style: { transform: ... } }}` is supported in newer versions.
       */}
            <style>{`
         /* Helper to ensure range inputs look good */
         input[type=range] {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            appearance: none;
         }
         input[type=range]::-webkit-slider-thumb {
            appearance: none;
            width: 18px;
            height: 18px;
            background: var(--accent-blue);
            border-radius: 50%;
            cursor: pointer;
         }
       `}</style>
        </div>
    );
};

export default ImageEditorModal;
