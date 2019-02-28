import { InjectionToken } from '@angular/core';
import { CdkAccordion } from '@angular/cdk/accordion';


/**
 * Base interface for a {@link TsAccordionComponent}
 */
export interface TsAccordionBase extends CdkAccordion {
  /**
   * Handle keyboard events coming in from the panel triggers
   */
  handleTriggerKeydown: (event: KeyboardEvent) => void;

  /**
   * Handle focus events on the panel triggers
   */
  handleTriggerFocus: (trigger: any) => void;

  /**
   * Determine if the toggle icon should be hidden
   */
  hideToggle: boolean;
}


/**
 * Token used to provide a {@link TsAccordionComponent} to {@link TsExpansionPanelComponent}.
 *
 * Used primarily to avoid circular imports between `TsAccordionComponent` and `TsExpansionPanelComponent`.
 */
export const TS_ACCORDION = new InjectionToken<TsAccordionBase>('TS_ACCORDION');
