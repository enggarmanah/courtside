import React from 'react';
import {
  ChartPie, MapPin, Calendar, ChartBar, Buildings, List, Plus,
  Funnel, MagnifyingGlass, ArrowCounterClockwise, CaretLeft, CaretRight,
  CaretUp, CaretDown, X, Check, Moon, Sun, User, Question,
  SignOut, Gear, Sliders, Clock, CurrencyDollar, Info, Eye, EyeSlash,
  Lock, LockOpen, Bell, House, NumberCircleOne, NumberCircleTwo,
  NumberCircleThree, NumberCircleFour, Phone, Envelope, TennisBall,
  SignIn, CheckCircle, WarningCircle, Spinner,
} from '@phosphor-icons/react';
import { IconProps } from '@phosphor-icons/react';

export type IconName =
  | 'chart-pie' | 'map-pin' | 'calendar' | 'chart-bar' | 'building'
  | 'list' | 'plus' | 'filter' | 'search' | 'refresh'
  | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'chevron-down'
  | 'x' | 'check' | 'moon' | 'sun' | 'user' | 'question'
  | 'exit' | 'settings' | 'sliders' | 'clock' | 'dollar'
  | 'info' | '1' | '2' | '3' | '4' | 'view' | 'view-off' | 'lock' | 'lock-open' | 'bell' | 'home'
  | 'phone' | 'envelope' | 'tennis-ball' | 'sign-out' | 'sign-in'
  | 'check-circle' | 'warning-circle' | 'spinner';

const iconMap: Record<IconName, React.ComponentType<IconProps>> = {
  'chart-pie': ChartPie,
  'map-pin': MapPin,
  'calendar': Calendar,
  'chart-bar': ChartBar,
  'building': Buildings,
  'list': List,
  'plus': Plus,
  'filter': Funnel,
  'search': MagnifyingGlass,
  'refresh': ArrowCounterClockwise,
  'chevron-left': CaretLeft,
  'chevron-right': CaretRight,
  'chevron-up': CaretUp,
  'chevron-down': CaretDown,
  'x': X,
  'check': Check,
  'moon': Moon,
  'sun': Sun,
  'user': User,
  'question': Question,
  'exit': SignOut,
  'settings': Gear,
  'sliders': Sliders,
  'clock': Clock,
  'dollar': CurrencyDollar,
  'info': Info,
  'view': Eye,
  'view-off': EyeSlash,
  'lock': Lock,
  'lock-open': LockOpen,
  'bell': Bell,
  'home': House,
  'phone': Phone,
  'envelope': Envelope,
  'tennis-ball': TennisBall,
  '1': NumberCircleOne,
  '2': NumberCircleTwo,
  '3': NumberCircleThree,
  '4': NumberCircleFour,
  'sign-out': SignOut,
  'sign-in': SignIn,
  'check-circle': CheckCircle,
  'warning-circle': WarningCircle,
  'spinner': Spinner,
};

interface CustomIconProps extends Partial<IconProps> {
  name: IconName;
  className?: string;
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
}

export const Icon: React.FC<CustomIconProps> = ({ name, className, size = 20, weight = 'regular', ...rest }) => {
  const Component = iconMap[name] || Question;
  return <Component className={className} size={size} weight={weight} {...rest} />;
};

export { ChartPie, MapPin, Calendar, ChartBar, Buildings, List, Plus, Funnel, MagnifyingGlass, ArrowCounterClockwise, CaretLeft, CaretRight, CaretUp, CaretDown, X, Check, Moon, Sun, User, Question, SignOut, SignIn, Gear, Sliders, Clock, CurrencyDollar, Info, Eye, EyeSlash, Lock, LockOpen, Bell };