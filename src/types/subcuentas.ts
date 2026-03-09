export type DeleteSubcuentaAction = 'transfer_to_principal' | 'discard';

export type DeleteSubcuentaRequest = {
  action: DeleteSubcuentaAction;
  note?: string;
};

export type DeleteSubcuentaResponse = {
  message?: string;
  action: DeleteSubcuentaAction;
  principalDelta?: number;
  deleted?: {
    transactions?: number;
    historialRecurrente?: number;
    recurrentes?: number;
  };
};
