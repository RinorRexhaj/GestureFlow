"""PyTorch LSTM model for gesture recognition.

Input:  (batch_size, sequence_length, input_size=63)
Output: (batch_size, num_classes)
"""
from __future__ import annotations

import torch
import torch.nn as nn


class GestureLSTM(nn.Module):
    """Configurable LSTM classifier for hand gesture sequences.

    Parameters
    ----------
    num_classes:
        Number of gesture classes to predict.
    input_size:
        Feature dimensionality per time-step (default: 63 = 21 landmarks × 3).
    hidden_size:
        LSTM hidden state size.
    num_layers:
        Number of stacked LSTM layers.
    bidirectional:
        If True, use a bidirectional LSTM; output size doubles.
    dropout:
        Dropout probability applied between LSTM layers (and after the last
        LSTM layer when ``num_layers > 1``).
    """

    def __init__(
        self,
        num_classes: int,
        input_size: int = 63,
        hidden_size: int = 128,
        num_layers: int = 2,
        bidirectional: bool = False,
        dropout: float = 0.3,
    ) -> None:
        super().__init__()

        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.num_directions = 2 if bidirectional else 1

        lstm_dropout = dropout if num_layers > 1 else 0.0

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=bidirectional,
            dropout=lstm_dropout,
        )

        # Post-LSTM dropout applied before the classifier
        self.dropout = nn.Dropout(dropout)

        fc_input_size = hidden_size * self.num_directions
        self.classifier = nn.Linear(fc_input_size, num_classes)

    # ------------------------------------------------------------------
    # Forward pass
    # ------------------------------------------------------------------

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Run the forward pass.

        Parameters
        ----------
        x:
            Shape ``(batch, seq_len, input_size)``.

        Returns
        -------
        torch.Tensor
            Raw logits of shape ``(batch, num_classes)``.
        """
        # lstm_out: (batch, seq_len, num_directions * hidden_size)
        lstm_out, _ = self.lstm(x)

        # Take the last time-step's output
        last_out = lstm_out[:, -1, :]  # (batch, num_directions * hidden_size)

        out = self.dropout(last_out)
        logits = self.classifier(out)
        return logits

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """Return softmax probabilities.

        Parameters
        ----------
        x:
            Shape ``(batch, seq_len, input_size)``.
        """
        logits = self.forward(x)
        return torch.softmax(logits, dim=-1)

    @classmethod
    def from_config(cls, num_classes: int, cfg: "ModelConfig") -> "GestureLSTM":  # type: ignore[name-defined]  # noqa: F821
        """Instantiate from an :class:`~app.utils.config.ModelConfig` object."""
        return cls(
            num_classes=num_classes,
            hidden_size=cfg.hidden_size,
            num_layers=cfg.num_layers,
            bidirectional=cfg.bidirectional,
            dropout=cfg.dropout,
        )
