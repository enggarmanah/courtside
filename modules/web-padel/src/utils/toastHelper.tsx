import toast from 'react-hot-toast';
import { TFunction } from 'i18next';
import { Icon } from '../components/common';

const capitalizeFirstLetter = (message: string): string => {
  const firstLetterIndex = message.search(/[A-Za-z]/);
  if (firstLetterIndex === -1) return message;
  return `${message.slice(0, firstLetterIndex)}${message[firstLetterIndex].toUpperCase()}${message.slice(firstLetterIndex + 1)}`;
};

const formatToastMessage = (message: string | React.ReactNode): string | React.ReactNode => {
  return typeof message === 'string' ? capitalizeFirstLetter(message) : message;
};

/**
 * Helper to show a customized success toast
 */
export const showSuccessToast = (message: string) => {
  const formattedMessage = formatToastMessage(message);

  toast.custom((t) => (
    <div
      onClick={() => toast.dismiss(t.id)}
      className={`${t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white dark:bg-slate-800 shadow-lg rounded-md pointer-events-auto flex ring-1 ring-black dark:ring-slate-600 ring-opacity-5 border-l-[6px] border-green-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors`}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 pt-0.5">
            <Icon name="check-circle" size={24} className="text-green-500" weight="fill" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {formattedMessage}
            </p>
          </div>
        </div>
      </div>
    </div>
  ), { duration: 3000 });
};

/**
 * Helper to show a customized error toast
 */
export const showErrorToast = (message: string | React.ReactNode) => {
  const formattedMessage = formatToastMessage(message);

  toast.custom((t) => (
    <div
      onClick={() => toast.dismiss(t.id)}
      className={`${t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white dark:bg-slate-800 shadow-lg rounded-md pointer-events-auto flex ring-1 ring-black dark:ring-slate-600 ring-opacity-5 border-l-[6px] border-red-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors`}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 pt-0.5">
            <Icon name="warning-circle" size={24} className="text-red-500" weight="fill" />
          </div>
          <div className="ml-3 flex-1">
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {formattedMessage}
            </div>
          </div>
        </div>
      </div>
    </div>
  ), { duration: 5000 });
};

/**
 * Displays a standardized error toast for missing required fields.
 */
export const errorMissingFields = (missingFields: string[], t: TFunction) => {
  if (missingFields.length === 0) {
    return;
  }

  const message = (
    <div>
      <div>{t('action.requiredFields', 'Please fill in required fields:')}</div>
      <div className="mt-1">
        {missingFields.map((field, index) => (
          <div key={index} className="">• {field}</div>
        ))}
      </div>
    </div>
  );

  showErrorToast(message);
};

export const errorMessage = (message: string) => {
  showErrorToast(message);
};

/**
 * Helper to show a customized loading toast
 */
export const showLoadingToast = (message: string) => {
  const formattedMessage = formatToastMessage(message);

  return toast.custom((t) => (
    <div
      className={`${t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white dark:bg-slate-800 shadow-lg rounded-md pointer-events-auto flex ring-1 ring-black dark:ring-slate-600 ring-opacity-5 border-l-[6px] border-brand-500`}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 pt-0.5">
            <Icon name="spinner" size={24} className="text-brand-500 animate-spin" weight="regular" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {formattedMessage}
            </p>
          </div>
        </div>
      </div>
    </div>
  ), { duration: Infinity });
};

/**
 * Helper to dismiss any specific toast by ID
 */
export const dismissToast = (id: string) => {
  toast.dismiss(id);
};
