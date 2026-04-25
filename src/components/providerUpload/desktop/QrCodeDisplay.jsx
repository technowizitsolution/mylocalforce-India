import { QRCodeSVG } from 'qrcode.react';
import { FiRefreshCw } from 'react-icons/fi';

/**
 * Renders a secure mobile upload QR code.
 *
 * @param {Object} props
 * @param {string} props.mobileUrl
 * @param {boolean} [props.canRefresh]
 * @param {boolean} [props.loading]
 * @param {Function} [props.onRefresh]
 * @returns {JSX.Element|null}
 */
const QrCodeDisplay = ({ mobileUrl, canRefresh, loading, onRefresh }) => {
  if (!mobileUrl) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col items-center gap-3">
        <QRCodeSVG value={mobileUrl} size={220} />
        <a
          href={mobileUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all text-center text-xs font-semibold text-blue-600"
        >
          {mobileUrl}
        </a>
        {canRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh link
          </button>
        )}
      </div>
    </div>
  );
};

export default QrCodeDisplay;
