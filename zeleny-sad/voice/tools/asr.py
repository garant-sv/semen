"""Russian speech recognition (GigaAM v2 via sherpa-onnx), used to check the recordings."""
import os, sys, json
import sherpa_onnx, soundfile as sf, numpy as np
D=os.environ.get('ASR_DIR', 'sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19') + '/'
rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=D+'encoder.int8.onnx', decoder=D+'decoder.onnx', joiner=D+'joiner.onnx', tokens=D+'tokens.txt', num_threads=4, model_type='nemo_transducer')
def transcribe(path):
    a, sr = sf.read(path, dtype='float32')
    if a.ndim > 1: a = a.mean(1)
    if sr != 16000:
        import scipy.signal as ss
        a = ss.resample_poly(a, 16000, sr).astype('float32')
    a = np.concatenate([np.zeros(4800, 'float32'), a, np.zeros(4800, 'float32')])
    s = rec.create_stream(); s.accept_waveform(16000, a); rec.decode_stream(s)
    return s.result.text
if __name__ == '__main__':
    for p in sys.argv[1:]: print(p, '→', transcribe(p))
